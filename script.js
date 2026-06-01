// =====================================================
// SCRIPT PRINCIPAL - VERSÃO REFATORADA
// =====================================================

document.addEventListener("DOMContentLoaded", async () => {
    await initDatabase();
    
    // Data atual
    document.getElementById("currentDate").innerText = new Date().toLocaleDateString('pt-BR', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    });
    
    // Eventos do menu
    document.querySelectorAll(".menu-item").forEach(btn => {
        btn.addEventListener("click", () => showSection(btn.dataset.section));
    });
    
    updateStats();
    renderCertificates();
    renderParticipantes();
    showSection('cadastro');
});

// =====================================================
// NAVEGAÇÃO
// =====================================================

function showSection(sectionId) {
    document.querySelectorAll(".content-section").forEach(s => s.classList.add("hidden"));
    document.getElementById(sectionId)?.classList.remove("hidden");
    
    document.querySelectorAll(".menu-item").forEach(btn => btn.classList.remove("active"));
    document.querySelector(`.menu-item[data-section="${sectionId}"]`)?.classList.add("active");
    
    if (sectionId === 'certificados') renderCertificates();
    if (sectionId === 'participantes') renderParticipantes();
    if (sectionId === 'relatorios') gerarRelatorio();
}

// =====================================================
// ESTATÍSTICAS
// =====================================================

function updateStats() {
    const stats = getEstatisticas();
    const statsHtml = `
        <div class="stat-card">
            <div class="stat-icon">🎓</div>
            <div>
                <h2 class="stat-value">${stats.total}</h2>
                <p>Certificados Emitidos</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">✅</div>
            <div>
                <h2 class="stat-value">${stats.validos}</h2>
                <p>Certificados Válidos</p>
            </div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⏳</div>
            <div>
                <h2 class="stat-value">${stats.pendentes}</h2>
                <p>Pendentes</p>
            </div>
        </div>
    `;
    
    const statsContainer = document.getElementById("statsContainer");
    const relatorioStats = document.getElementById("relatorioStats");
    if (statsContainer) statsContainer.innerHTML = statsHtml;
    if (relatorioStats) relatorioStats.innerHTML = statsHtml;
}

// =====================================================
// GERAR CERTIFICADOS
// =====================================================

function generateCertificates() {
    const courseType = document.getElementById("courseType").value;
    const courseDate = document.getElementById("courseDate").value;
    const instructor = document.getElementById("instructor").value.trim();
    const workload = document.getElementById("workload").value;
    const programContent = document.getElementById("programContent").value.trim();
    const participantsRaw = document.getElementById("participantsList").value.trim();
    
    if (!courseType || !courseDate || !instructor || !workload || !programContent || !participantsRaw) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }
    
    const treinamentoId = insertTreinamento(courseType, courseDate, instructor, workload, programContent);
    const lines = participantsRaw.split("\n").filter(l => l.trim());
    let inseridos = 0, erros = [];
    
    for (const line of lines) {
        const parts = line.split(",");
        if (parts.length < 2) {
            erros.push(`"${line}" - formato inválido`);
            continue;
        }
        
        const nome = parts[0].trim();
        const cpf = parts[1].replace(/\D/g, "");
        
        if (nome.length < 3) {
            erros.push(`${nome} - nome inválido`);
            continue;
        }
        
        if (!validarCPF(cpf)) {
            erros.push(`${nome} - CPF inválido`);
            continue;
        }
        
        if (cpfExiste(cpf)) {
            erros.push(`${nome} - CPF já cadastrado`);
            continue;
        }
        
        insertParticipante(treinamentoId, nome, cpf);
        inseridos++;
    }
    
    updateStats();
    renderCertificates();
    renderParticipantes();
    clearForm();
    showSection('certificados');
    
    let msg = `${inseridos} certificado(s) gerado(s).`;
    if (erros.length) msg += `\n\n${erros.length} registro(s) ignorado(s):\n${erros.join("\n")}`;
    alert(msg);
}

// =====================================================
// RENDERIZAR CERTIFICADOS
// =====================================================

function renderCertificates() {
    const container = document.getElementById("certContainer");
    if (!container) return;
    
    const data = getAllParticipantes();
    
    if (!data.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">📜</div><h3>Nenhum certificado encontrado</h3><p>Cadastre um treinamento para gerar certificados.</p></div>`;
        return;
    }
    
    container.innerHTML = data.map(cert => `
        <div class="certificate-card">
            <div class="cert-header">
                <h3>${escapeHtml(cert.nome)}</h3>
                <small>${escapeHtml(cert.curso)}</small>
            </div>
            <div class="cert-body">
                <div class="cert-info"><strong>CPF</strong><span>${formatCPF(cert.cpf)}</span></div>
                <div class="cert-info"><strong>Data</strong><span>${formatDate(cert.data_curso)}</span></div>
                <div class="cert-info"><strong>Instrutor</strong><span>${escapeHtml(cert.instrutor)}</span></div>
                <div class="cert-info"><span class="cert-status valid">✔ Válido</span></div>
            </div>
            <div class="cert-actions">
                <button class="btn btn-primary" onclick="viewCertificate(${cert.id})">Visualizar</button>
                <button class="btn btn-secondary" onclick="printCertificate(${cert.id})">Imprimir</button>
                <button class="btn btn-danger" onclick="deleteCertificate(${cert.id})">Excluir</button>
            </div>
        </div>
    `).join('');
}

function filterCertificates() {
    const term = document.getElementById("searchCert")?.value.toLowerCase() || "";
    const all = getAllParticipantes();
    const filtered = all.filter(p => 
        p.nome.toLowerCase().includes(term) || 
        p.cpf.includes(term) || 
        p.curso.toLowerCase().includes(term)
    );
    
    const container = document.getElementById("certContainer");
    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Nenhum resultado encontrado</h3></div>`;
        return;
    }
    
    container.innerHTML = filtered.map(cert => `
        <div class="certificate-card">
            <div class="cert-header">
                <h3>${escapeHtml(cert.nome)}</h3>
                <small>${escapeHtml(cert.curso)}</small>
            </div>
            <div class="cert-body">
                <div class="cert-info"><strong>CPF</strong><span>${formatCPF(cert.cpf)}</span></div>
                <div class="cert-info"><strong>Instrutor</strong><span>${escapeHtml(cert.instrutor)}</span></div>
            </div>
            <div class="cert-actions">
                <button class="btn btn-primary" onclick="viewCertificate(${cert.id})">Visualizar</button>
            </div>
        </div>
    `).join('');
}

// =====================================================
// PARTICIPANTES
// =====================================================

function renderParticipantes() {
    const container = document.getElementById("participantesContainer");
    if (!container) return;
    
    const data = getAllParticipantes();
    
    if (!data.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">👥</div><h3>Nenhum participante cadastrado</h3></div>`;
        return;
    }
    
    container.innerHTML = data.map(p => `
        <div class="certificate-card">
            <div class="cert-header">
                <h3>${escapeHtml(p.nome)}</h3>
                <small>${escapeHtml(p.curso)}</small>
            </div>
            <div class="cert-body">
                <div class="cert-info"><strong>CPF</strong><span>${formatCPF(p.cpf)}</span></div>
                <div class="cert-info"><strong>Data do Curso</strong><span>${formatDate(p.data_curso)}</span></div>
                <div class="cert-info"><strong>Instrutor</strong><span>${escapeHtml(p.instrutor)}</span></div>
                <div class="cert-info"><strong>Carga Horária</strong><span>${p.carga_horaria}h</span></div>
            </div>
        </div>
    `).join('');
}

function filterParticipantes() {
    const term = document.getElementById("searchParticipante")?.value.toLowerCase() || "";
    const all = getAllParticipantes();
    const filtered = all.filter(p => p.nome.toLowerCase().includes(term) || p.cpf.includes(term));
    
    const container = document.getElementById("participantesContainer");
    if (!filtered.length) {
        container.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🔍</div><h3>Nenhum participante encontrado</h3></div>`;
        return;
    }
    
    container.innerHTML = filtered.map(p => `
        <div class="certificate-card">
            <div class="cert-header">
                <h3>${escapeHtml(p.nome)}</h3>
                <small>${escapeHtml(p.curso)}</small>
            </div>
            <div class="cert-body">
                <div class="cert-info"><strong>CPF</strong><span>${formatCPF(p.cpf)}</span></div>
                <div class="cert-info"><strong>Data</strong><span>${formatDate(p.data_curso)}</span></div>
                <div class="cert-info"><strong>Instrutor</strong><span>${escapeHtml(p.instrutor)}</span></div>
            </div>
        </div>
    `).join('');
}

// =====================================================
// CERTIFICADO - VISUALIZAR, IMPRIMIR, EXCLUIR
// =====================================================

function viewCertificate(id) {
    const p = getParticipanteById(id);
    if (!p) {
        alert("Certificado não encontrado.");
        return;
    }
    
    document.getElementById("certificatePreview").innerHTML = `
        <div class="certificate-document">
            <div class="certificate-logo">SENAI</div>
            <div class="certificate-title">CERTIFICADO</div>
            <div class="certificate-text">Certificamos que</div>
            <div class="certificate-name">${escapeHtml(p.nome)}</div>
            <div class="certificate-text">CPF: ${formatCPF(p.cpf)}<br>concluiu com aproveitamento o treinamento</div>
            <div class="certificate-course">${escapeHtml(p.curso)}</div>
            <div class="certificate-details">
                <div><strong>Data de Realização</strong><br>${formatDate(p.data_curso)}</div>
                <div><strong>Carga Horária</strong><br>${p.carga_horaria} horas</div>
                <div><strong>Instrutor Responsável</strong><br>${escapeHtml(p.instrutor)}</div>
                <div><strong>Conteúdo Programático</strong><br>${escapeHtml(p.conteudo_programatico)}</div>
            </div>
            <div class="certificate-signature">
                <div class="signature-line"></div>
                <strong>${escapeHtml(p.instrutor)}</strong><br>
                Instrutor Responsável
            </div>
        </div>
    `;
    
    document.getElementById("certificateModal").classList.remove("hidden");
}

function printCertificate(id) {
    viewCertificate(id);
    setTimeout(() => window.print(), 200);
}

function deleteCertificate(id) {
    if (confirm("Deseja realmente excluir este certificado?")) {
        deleteParticipante(id);
        renderCertificates();
        renderParticipantes();
        updateStats();
        alert("Certificado excluído com sucesso!");
    }
}

function closeCertificateModal() {
    document.getElementById("certificateModal").classList.add("hidden");
}

// =====================================================
// RELATÓRIOS
// =====================================================

function gerarRelatorio() {
    const stats = getEstatisticas();
    const participantes = getAllParticipantes();
    
    const cursos = {};
    participantes.forEach(p => {
        cursos[p.curso] = (cursos[p.curso] || 0) + 1;
    });
    
    const topCursos = Object.entries(cursos)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([curso, qtd]) => `${curso}: ${qtd} certificados`)
        .join("<br>");
    
    document.getElementById("resumoTexto").innerHTML = `
        <strong>📊 Visão Geral</strong><br><br>
        • Total de certificados emitidos: <strong>${stats.total}</strong><br>
        • Certificados válidos: <strong>${stats.validos}</strong><br>
        • Certificados pendentes: <strong>${stats.pendentes}</strong><br>
        • Total de participantes únicos: <strong>${participantes.length}</strong><br><br>
        <strong>🏆 Treinamentos mais realizados:</strong><br>
        ${topCursos || "Nenhum treinamento cadastrado ainda."}
    `;
}

function exportarRelatorio() {
    const dados = exportarDadosJSON();
    const blob = new Blob([dados], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `relatorio_senai_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert("Relatório exportado com sucesso!");
}

// =====================================================
// UTILITÁRIOS
// =====================================================

function clearForm() {
    document.getElementById("trainingForm").reset();
}

function formatDate(dateString) {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatCPF(cpf) {
    if (!cpf || cpf.length !== 11) return cpf;
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

function escapeHtml(text) {
    if (!text) return "";
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
}

// Fechar modal ao clicar fora
window.onclick = function(event) {
    const modal = document.getElementById("certificateModal");
    if (event.target === modal) {
        closeCertificateModal();
    }
};