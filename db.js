// =====================================================
// BANCO DE DADOS SQLITE - VERSÃO CORRIGIDA
// =====================================================

let db = null;

// =====================================================
// INICIALIZAÇÃO
// =====================================================

async function initDatabase() {
    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.js";
        script.onload = async () => {
            try {
                const SQL = await initSqlJs({
                    locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
                });
                const savedData = localStorage.getItem("senai_db");
                if (savedData) {
                    const uint8Array = new Uint8Array(JSON.parse(savedData));
                    db = new SQL.Database(uint8Array);
                } else {
                    db = new SQL.Database();
                    createTables();
                }
                console.log("Banco iniciado com sucesso!");
                resolve();
            } catch (error) {
                console.error(error);
                reject(error);
            }
        };
        document.head.appendChild(script);
    });
}

// =====================================================
// SALVAR LOCAL STORAGE
// =====================================================

function saveDatabase() {
    const data = db.export();
    localStorage.setItem("senai_db", JSON.stringify(Array.from(data)));
}

// =====================================================
// CRIAR TABELAS - CORRIGIDO
// =====================================================

function createTables() {
    // Tabela de treinamentos com o nome correto da coluna
    db.run(`
        CREATE TABLE IF NOT EXISTS treinamentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT NOT NULL,
            data_realizacao TEXT NOT NULL,
            instrutor TEXT NOT NULL,
            carga_horaria INTEGER NOT NULL,
            conteudo_programatico TEXT NOT NULL,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS participantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            treinamento_id INTEGER NOT NULL,
            nome TEXT NOT NULL,
            cpf TEXT NOT NULL UNIQUE,
            status TEXT DEFAULT 'valido',
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (treinamento_id) REFERENCES treinamentos(id)
        )
    `);

    saveDatabase();
    console.log("Tabelas criadas com sucesso!");
}

// =====================================================
// TREINAMENTOS
// =====================================================

function insertTreinamento(tipo, data, instrutor, cargaHoraria, conteudo) {
    db.run(`
        INSERT INTO treinamentos (tipo, data_realizacao, instrutor, carga_horaria, conteudo_programatico)
        VALUES (?, ?, ?, ?, ?)
    `, [tipo, data, instrutor, cargaHoraria, conteudo]);
    saveDatabase();
    const result = db.exec("SELECT last_insert_rowid()");
    return result[0].values[0][0];
}

// =====================================================
// PARTICIPANTES
// =====================================================

function insertParticipante(treinamentoId, nome, cpf) {
    db.run(`
        INSERT INTO participantes (treinamento_id, nome, cpf, status)
        VALUES (?, ?, ?, 'valido')
    `, [treinamentoId, nome, cpf]);
    saveDatabase();
}

// =====================================================
// CPF EXISTE
// =====================================================

function cpfExiste(cpf) {
    const result = db.exec("SELECT id FROM participantes WHERE cpf = ? LIMIT 1", [cpf]);
    return result.length > 0;
}

// =====================================================
// LISTAR TODOS OS PARTICIPANTES - CORRIGIDO
// =====================================================

function getAllParticipantes() {
    try {
        const result = db.exec(`
            SELECT 
                p.id, p.nome, p.cpf, p.status,
                t.tipo AS curso, 
                t.data_realizacao AS data_curso, 
                t.instrutor, 
                t.carga_horaria, 
                t.conteudo_programatico
            FROM participantes p
            INNER JOIN treinamentos t ON p.treinamento_id = t.id
            ORDER BY p.id DESC
        `);
        
        if (!result.length) return [];
        
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const obj = {};
            columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
        });
    } catch(e) {
        console.error("Erro ao buscar participantes:", e);
        return [];
    }
}

// =====================================================
// BUSCAR PARTICIPANTE POR ID
// =====================================================

function getParticipanteById(id) {
    const result = db.exec(`
        SELECT 
            p.id, p.nome, p.cpf, p.status,
            t.tipo AS curso, 
            t.data_realizacao AS data_curso, 
            t.instrutor, 
            t.carga_horaria, 
            t.conteudo_programatico
        FROM participantes p
        INNER JOIN treinamentos t ON p.treinamento_id = t.id
        WHERE p.id = ? LIMIT 1
    `, [id]);
    
    if (!result.length) return null;
    
    const columns = result[0].columns;
    const row = result[0].values[0];
    const obj = {};
    columns.forEach((col, i) => { obj[col] = row[i]; });
    return obj;
}

// =====================================================
// EXCLUIR PARTICIPANTE
// =====================================================

function deleteParticipante(id) {
    db.run("DELETE FROM participantes WHERE id = ?", [id]);
    saveDatabase();
}

// =====================================================
// ESTATÍSTICAS
// =====================================================

function getEstatisticas() {
    const total = db.exec("SELECT COUNT(*) FROM participantes");
    const validos = db.exec("SELECT COUNT(*) FROM participantes WHERE status='valido'");
    return {
        total: total[0]?.values[0][0] || 0,
        validos: validos[0]?.values[0][0] || 0,
        pendentes: (total[0]?.values[0][0] || 0) - (validos[0]?.values[0][0] || 0)
    };
}

// =====================================================
// BACKUP
// =====================================================

function backupBanco() {
    const dados = localStorage.getItem("senai_db");
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "backup_senai_certificados.json";
    a.click();
    URL.revokeObjectURL(url);
}

// =====================================================
// EXPORTAR JSON
// =====================================================

function exportarDadosJSON() {
    const treinamentos = db.exec("SELECT * FROM treinamentos");
    const participantes = getAllParticipantes();
    return JSON.stringify({ treinamentos, participantes }, null, 4);
}

// =====================================================
// RESET TOTAL
// =====================================================

function resetSistema() {
    if (confirm("Deseja apagar TODOS os dados?")) {
        localStorage.removeItem("senai_db");
        location.reload();
    }
}

// =====================================================
// VALIDAÇÃO DE CPF
// =====================================================

function validarCPF(cpf) {
    cpf = cpf.replace(/\D/g, "");
    if (cpf.length !== 11 || /^(\d)\1+$/.test(cpf)) return false;
    let soma = 0, resto;
    for (let i = 1; i <= 9; i++) soma += parseInt(cpf.substring(i-1, i)) * (11 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    if (resto !== parseInt(cpf.substring(9, 10))) return false;
    soma = 0;
    for (let i = 1; i <= 10; i++) soma += parseInt(cpf.substring(i-1, i)) * (12 - i);
    resto = (soma * 10) % 11;
    if (resto === 10 || resto === 11) resto = 0;
    return resto === parseInt(cpf.substring(10, 11));
}