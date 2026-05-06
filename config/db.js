require('dotenv').config();
const { Client } = require('pg');

const { DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, DB_SSL, DATABASE_URL } = process.env;

if (!DB_HOST || !DB_USER || !DB_NAME) {
    console.warn(
        "Configuration DB incomplète: vérifiez DB_HOST, DB_USER, DB_PASSWORD, DB_NAME dans .env"
    );
}

const parseSsl = () => {
    if (!DB_SSL) return false;
    const sslValue = String(DB_SSL).toLowerCase();
    if (sslValue === 'true' || sslValue === '1') {
        return { rejectUnauthorized: false };
    }
    return false;
};

const connectionConfig = DATABASE_URL
    ? {
        connectionString: DATABASE_URL,
        ssl: parseSsl()
    }
    : {
        host: DB_HOST,
        port: DB_PORT ? Number(DB_PORT) : 5432,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: parseSsl()
    };

const client = new Client(connectionConfig);

let connected = false;
let txOpen = false;
let connectingPromise = null;

const transformSql = (sql) => {
    let output = sql;
    output = output.replace(/IFNULL\s*\(/gi, 'COALESCE(');
    output = output.replace(/CURDATE\s*\(\s*\)/gi, 'CURRENT_DATE');
    output = output.replace(
        /DATE_FORMAT\s*\(\s*([^,]+)\s*,\s*'%Y-%m'\s*\)/gi,
        "TO_CHAR($1, 'YYYY-MM')"
    );
    output = output.replace(/LEFT\s*\(\s*([^,]+)\s*,\s*7\s*\)/gi, "SUBSTRING($1 FROM 1 FOR 7)");
    return output;
};

const toPgSql = (sql) => {
    const transformed = transformSql(sql);
    let i = 0;
    return transformed.replace(/\?/g, () => {
        i += 1;
        return `$${i}`;
    });
};

const getStatementType = (sql) => {
    const trimmed = String(sql || '').trim().toUpperCase();
    return trimmed.split(/\s+/)[0] || '';
};

const normalizeResult = (result) => {
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    const normalized = {
        rows,
        affectedRows: typeof result?.rowCount === 'number' ? result.rowCount : 0
    };

    if (rows.length > 0 && typeof rows[0] === 'object' && rows[0] !== null) {
        const firstKey = Object.keys(rows[0])[0];
        if (firstKey) normalized.insertId = rows[0][firstKey];
    }

    return normalized;
};

const db = {
    connect: (callback) => {
        if (connected) {
            if (typeof callback === 'function') callback(null);
            return;
        }

        if (!connectingPromise) {
            connectingPromise = client.connect()
                .then(() => {
                    connected = true;
                    connectingPromise = null;
                    return null;
                })
                .catch((err) => {
                    connectingPromise = null;
                    throw err;
                });
        }

        connectingPromise
            .then(() => {
                console.log('Connecté à PostgreSQL');
                if (typeof callback === 'function') callback(null);
            })
            .catch((err) => {
                console.log('Erreur connexion PostgreSQL :', err);
                if (typeof callback === 'function') callback(err);
            });
    },

    query: (sql, params, callback) => {
        let values = params;
        let cb = callback;

        if (typeof params === 'function') {
            cb = params;
            values = [];
        }
        if (!Array.isArray(values)) values = [];

        const run = async () => {
            if (!connected) await db._connectPromise();
            const pgSql = toPgSql(sql);
            return client.query(pgSql, values);
        };

        if (typeof cb === 'function') {
            run()
                .then((result) => {
                    const normalized = normalizeResult(result);
                    const statementType = getStatementType(sql);
                    const mysqlLikeResult = statementType === 'SELECT'
                        ? result.rows
                        : normalized;
                    cb(null, mysqlLikeResult);
                })
                .catch((err) => cb(err));
            return;
        }

        return run();
    },

    beginTransaction: (callback) => {
        if (typeof callback !== 'function') return;
        db.query('BEGIN', (err) => {
            if (!err) txOpen = true;
            callback(err);
        });
    },

    commit: (callback) => {
        if (typeof callback !== 'function') return;
        db.query('COMMIT', (err) => {
            txOpen = false;
            callback(err);
        });
    },

    rollback: (callback) => {
        if (!txOpen) {
            if (typeof callback === 'function') callback();
            return;
        }
        db.query('ROLLBACK', () => {
            txOpen = false;
            if (typeof callback === 'function') callback();
        });
    },

    end: (callback) => {
        client.end()
            .then(() => {
                connected = false;
                if (typeof callback === 'function') callback();
            })
            .catch((err) => {
                if (typeof callback === 'function') callback(err);
            });
    },

    _connectPromise: async () => {
        if (connected) return;
        if (!connectingPromise) {
            connectingPromise = client.connect()
                .then(() => {
                    connected = true;
                    connectingPromise = null;
                    return null;
                })
                .catch((err) => {
                    connectingPromise = null;
                    throw err;
                });
        }
        await connectingPromise;
    }
};

db.connect();

module.exports = db;
