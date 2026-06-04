/* =============================================
   ALMOXARIFADO — Lógica principal
   app.js
   ============================================= */

// ---------- Estado global ----------
let materiais = {};
let historico = [];
let hoje = { entradas: 0, saidas: 0 };
let itemAtual = null;

// ---------- Persistência ----------

/**
 * Carrega materiais e histórico.
 * Recalcula os totais do dia atual.
 */

async function loadData() {

    try {

        const { data: materiaisDB, error: erroMateriais } =
            await db
                .from('materiais')
                .select('*');

        if (erroMateriais) throw erroMateriais;

        materiais = {};

        materiaisDB.forEach(item => {

            materiais[item.codigo] = {
                nome: item.nome,
                categoria: item.categoria,
                unidade: item.unidade,
                estoque: item.estoque,
                minimo: item.minimo
            };

        });

        const { data: historicoDB, error: erroHistorico } =
            await db
                .from('historico')
                .select('*')
                .order('criado_em', { ascending: false });

        if (erroHistorico) throw erroHistorico;

        historico = historicoDB.map(item => ({
            codigo: item.codigo,
            nome: item.nome,
            qty: item.qty,
            tipo: item.tipo,
            resp: item.resp,
            unidade: item.unidade,
            ts: item.criado_em
        }));

        const hojeStr = new Date().toDateString();

        hoje.entradas = historico
            .filter(r =>
                r.tipo === 'entrada' &&
                new Date(r.ts).toDateString() === hojeStr
            )
            .reduce((a, b) => a + b.qty, 0);

        hoje.saidas = historico
            .filter(r =>
                r.tipo === 'saida' &&
                new Date(r.ts).toDateString() === hojeStr
            )
            .reduce((a, b) => a + b.qty, 0);

    } catch (err) {

        console.error(err);

    }
}

// ---------- UI — Utilitários ----------

/**
 * Troca a aba visível.
 * @param {string} tab   - ID da seção ('scanner' | 'estoque' | 'cadastro' | 'historico')
 * @param {HTMLElement} btn - Botão clicado (para marcar como active)
 */
function showTab(tab, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');

  if (tab === 'estoque')   renderEstoque();
  if (tab === 'historico') renderHistorico();
  if (tab === 'cadastro')  renderCadastros();
  if (tab === 'scanner')   setTimeout(() => document.getElementById('scan-input').focus(), 50);
}

/** Atualiza os quatro cards de estatísticas no topo da página. */
function updateStats() {
  const total = Object.keys(materiais).length;
  const baixo = Object.values(materiais).filter(m => m.estoque <= m.minimo).length;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-entradas').textContent = hoje.entradas;
  document.getElementById('stat-saidas').textContent   = hoje.saidas;
  document.getElementById('stat-baixo').textContent    = baixo;
}

/**
 * Exibe uma mensagem de alerta temporária (3,5 s).
 * @param {string} msg    - Conteúdo HTML da mensagem
 * @param {string} tipo   - 'success' | 'danger'
 * @param {string} elemId - ID do elemento de alerta (padrão: 'alert-box')
 */
function showAlert(msg, tipo, elemId) {
  const el = document.getElementById(elemId || 'alert-box');
  const icon = tipo === 'success' ? 'circle-check' : 'alert-triangle';
  el.className = 'alert show alert-' + tipo;
  el.innerHTML = `<i class="ti ti-${icon}"></i> ${msg}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ---------- Scanner ----------

/** Busca o material pelo código digitado/escaneado. */
function buscarCodigo() {
  const cod = document.getElementById('scan-input').value.trim();
  if (!cod) return;

  const mat = materiais[cod];
  const preview = document.getElementById('preview-box');

  if (!mat) {
    preview.classList.remove('show');
    showAlert(`Código <strong>${cod}</strong> não encontrado. Vá em Cadastro para adicionar o material.`, 'danger');
    return;
  }

  itemAtual = cod;
  document.getElementById('preview-nome').textContent = mat.nome;
  document.getElementById('preview-info').innerHTML =
    `Código: <span style="font-family:var(--font-mono)">${cod}</span>
     &nbsp;|&nbsp; Estoque atual: <strong>${mat.estoque} ${mat.unidade}</strong>
     &nbsp;|&nbsp; Categoria: ${mat.categoria || '—'}`;
  document.getElementById('qty-input').value = 1;
  document.getElementById('resp-input').value = '';
  preview.classList.add('show');
  document.getElementById('qty-input').focus();
}

/**
 * Registra uma movimentação (entrada ou saída).
 * @param {'entrada'|'saida'} tipo
 */
function registrar(tipo) {

    if (!verificarAdmin()) {

        alert("Acesso restrito.");

        return;
    }
  if (!itemAtual) return;

  const qty  = parseInt(document.getElementById('qty-input').value) || 1;
  const resp = document.getElementById('resp-input').value.trim() || 'Não informado';
  const mat  = materiais[itemAtual];

  if (tipo === 'saida' && mat.estoque < qty) {
    showAlert(`Estoque insuficiente! Disponível: <strong>${mat.estoque} ${mat.unidade}</strong>`, 'danger');
    return;
  }

  if (tipo === 'entrada') { mat.estoque += qty; hoje.entradas += qty; }
  else                    { mat.estoque -= qty; hoje.saidas   += qty; }

  const reg = {
    ts:      new Date().toISOString(),
    codigo:  itemAtual,
    nome:    mat.nome,
    qty,
    tipo,
    resp,
    unidade: mat.unidade
  };

  historico.unshift(reg);
  if (historico.length > 1000) historico.pop(); // limite de registros

  updateStats();
  renderRecentes();

  const label = tipo === 'entrada' ? '✓ Entrada' : '✓ Saída';
  showAlert(`${label} de <strong>${qty} ${mat.unidade}</strong> — ${mat.nome}`, 'success');

  // Limpa o formulário e devolve o foco ao scanner
  document.getElementById('scan-input').value = '';
  document.getElementById('preview-box').classList.remove('show');
  document.getElementById('scan-input').focus();
  itemAtual = null;
}

/** Renderiza as últimas 10 movimentações na aba Scanner. */
function renderRecentes() {
  const tb   = document.getElementById('tb-recentes');
  const recs = historico.slice(0, 10);

  if (!recs.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty">Nenhuma movimentação ainda</td></tr>';
    return;
  }

  tb.innerHTML = recs.map(r => {
    const d    = new Date(r.ts);
    const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const badge = r.tipo === 'entrada'
      ? '<span class="badge badge-success">↓ Entrada</span>'
      : '<span class="badge badge-danger">↑ Saída</span>';
    return `<tr>
      <td>${hora}</td>
      <td class="mono">${r.codigo}</td>
      <td>${r.nome}</td>
      <td>${r.qty} ${r.unidade || ''}</td>
      <td>${badge}</td>
      <td>${r.resp}</td>
    </tr>`;
  }).join('');
}

// ---------- Estoque ----------

/** Renderiza a tabela de estoque com filtros aplicados. */
function renderEstoque() {
  const busca  = (document.getElementById('search-estoque').value || '').toLowerCase();
  const filtro = document.getElementById('filter-estoque').value;

  let items = Object.entries(materiais);
  if (busca)          items = items.filter(([c, m]) =>
    m.nome.toLowerCase().includes(busca) ||
    c.includes(busca) ||
    (m.categoria || '').toLowerCase().includes(busca)
  );
  if (filtro === 'baixo') items = items.filter(([, m]) => m.estoque <= m.minimo);
  if (filtro === 'ok')    items = items.filter(([, m]) => m.estoque >  m.minimo);

  const tb = document.getElementById('tb-estoque');
  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty">Nenhum material encontrado</td></tr>';
    return;
  }

  tb.innerHTML = items.map(([cod, m]) => {
    const baixo    = m.estoque <= m.minimo;
    const badge    = baixo
      ? '<span class="badge badge-warning">⚠ Baixo</span>'
      : '<span class="badge badge-success">OK</span>';
    const qtdStyle = baixo ? 'style="color:var(--warning-text);font-weight:600;"' : '';
    return `<tr class="${baixo ? 'low-stock' : ''}">
      <td class="mono">${cod}</td>
      <td>${m.nome}</td>
      <td>${m.categoria || '—'}</td>
      <td ${qtdStyle}>${m.estoque}</td>
      <td>${m.minimo}</td>
      <td>${m.unidade}</td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
}

// ---------- Cadastro ----------

/** Valida e salva um novo material. */
async function cadastrar() {

    if (!verificarAdmin()) {

        alert("Acesso restrito.");

        return;
    }

    const cod = document.getElementById('cad-codigo').value.trim();
    const nome = document.getElementById('cad-nome').value.trim();
    const categoria = document.getElementById('cad-categoria').value.trim();
    const unidade = document.getElementById('cad-unidade').value;
    const estoque = parseInt(document.getElementById('cad-estoque').value) || 0;
    const minimo = parseInt(document.getElementById('cad-minimo').value) || 5;

    if (!cod || !nome) {
        showAlert(
            'Código e nome são obrigatórios.',
            'danger',
            'cad-alert'
        );
        return;
    }

    const { error } = await db
        .from('materiais')
        .insert([{
            codigo: cod,
            nome,
            categoria,
            unidade,
            estoque,
            minimo
        }]);

    if (error) {

        console.error(error);

        showAlert(
            error.message,
            'danger',
            'cad-alert'
        );

        return;
    }

    await loadData();

    updateStats();
    renderCadastros();
    renderEstoque();

    showAlert(
        'Material cadastrado com sucesso.',
        'success',
        'cad-alert'
    );

    limparForm();
}

/** Limpa todos os campos do formulário de cadastro. */
function limparForm() {
  ['cad-codigo', 'cad-nome', 'cad-categoria'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('cad-estoque').value = '0';
  document.getElementById('cad-minimo').value  = '5';
  document.getElementById('cad-unidade').value = 'un';
}

/** Renderiza a tabela de materiais cadastrados. */
function renderCadastros() {
  const items = Object.entries(materiais);
  document.getElementById('total-cad').textContent = items.length;
  const tb = document.getElementById('tb-cadastros');

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="7" class="empty">Nenhum material cadastrado</td></tr>';
    return;
  }

  tb.innerHTML = items.map(([cod, m]) => `
    <tr>
      <td class="mono">${cod}</td>
      <td>${m.nome}</td>
      <td>${m.categoria || '—'}</td>
      <td>${m.unidade}</td>
      <td>${m.estoque}</td>
      <td>${m.minimo}</td>
      <td>
        <button onclick="editarItem('${cod}')" title="Editar"><i class="ti ti-edit"></i></button>
        <button onclick="deletar('${cod}')" title="Remover" style="margin-left:4px;"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
}

async function editarItem(cod) {

    if (!verificarAdmin()) {

        alert("Acesso restrito.");

        return;
    }

    const m = materiais[cod];

    const nome = prompt('Nome:', m.nome);
    if (nome === null) return;

    const categoria = prompt('Categoria:', m.categoria || '');
    if (categoria === null) return;

    const unidade = prompt('Unidade:', m.unidade);
    if (unidade === null) return;

    const estoque = prompt('Estoque:', m.estoque);
    if (estoque === null) return;

    const minimo = prompt('Mínimo:', m.minimo);
    if (minimo === null) return;

    const { error } = await db
        .from('materiais')
        .update({
            nome,
            categoria,
            unidade,
            estoque: Number(estoque),
            minimo: Number(minimo)
        })
        .eq('codigo', cod);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    await loadData();

    updateStats();
    renderCadastros();
    renderEstoque();

    alert('Material atualizado com sucesso!');
}

async function deletar(cod) {

    if (!verificarAdmin()) {

        alert("Acesso restrito.");

        return;
    }

    if (!confirm(`Remover "${materiais[cod].nome}" do cadastro?`))
        return;

    const { error } = await db
        .from('materiais')
        .delete()
        .eq('codigo', cod);

    if (error) {
        console.error(error);
        alert(error.message);
        return;
    }

    await loadData();

    updateStats();
    renderCadastros();
    renderEstoque();

    alert('Material removido com sucesso!');
}

// ---------- Histórico ----------

/** Renderiza o histórico com filtros de tipo e busca textual. */
function renderHistorico() {
  const tipo  = document.getElementById('hist-tipo').value;
  const busca = document.getElementById('hist-busca').value.toLowerCase();

  let items = [...historico];
  if (tipo)  items = items.filter(r => r.tipo === tipo);
  if (busca) items = items.filter(r =>
    r.nome.toLowerCase().includes(busca)   ||
    r.resp.toLowerCase().includes(busca)   ||
    r.codigo.toLowerCase().includes(busca)
  );

  const tb = document.getElementById('tb-historico');
  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty">Nenhum registro encontrado</td></tr>';
    return;
  }

  tb.innerHTML = items.map(r => {
    const d  = new Date(r.ts);
    const dt = d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const badge = r.tipo === 'entrada'
      ? '<span class="badge badge-success">↓ Entrada</span>'
      : '<span class="badge badge-danger">↑ Saída</span>';
    return `<tr>
      <td style="font-size:12px;white-space:nowrap;">${dt}</td>
      <td class="mono">${r.codigo}</td>
      <td>${r.nome}</td>
      <td>${r.qty} ${r.unidade || ''}</td>
      <td>${badge}</td>
      <td>${r.resp}</td>
    </tr>`;
  }).join('');
}

/** Limpa todo o histórico após confirmação. */
function limparHistorico() {
  if (!historico.length) return;
  if (!confirm('Limpar todo o histórico de movimentações? Esta ação não pode ser desfeita.')) return;
  historico = [];
  hoje = { entradas: 0, saidas: 0 };
  updateStats();
  renderRecentes();
  renderHistorico();
}

// ---------- Exportar / Importar ----------

/** Exporta o histórico de movimentações como CSV. */
function exportarCSV() {
  if (!historico.length) { alert('Nenhum registro para exportar.'); return; }
  const header = 'Data/Hora,Código,Material,Quantidade,Unidade,Tipo,Responsável\n';
  const rows = historico.map(r => {
    const d = new Date(r.ts).toLocaleString('pt-BR');
    return `"${d}","${r.codigo}","${r.nome}",${r.qty},"${r.unidade || ''}","${r.tipo}","${r.resp}"`;
  }).join('\n');
  const nome = 'almoxarifado_historico_' + new Date().toISOString().slice(0, 10) + '.csv';
  downloadFile('\uFEFF' + header + rows, nome, 'text/csv;charset=utf-8;');
}

/** Exporta o cadastro de materiais como CSV. */
function exportarMateriais() {
  if (!Object.keys(materiais).length) { alert('Nenhum material para exportar.'); return; }
  const header = 'Código,Nome,Categoria,Unidade,Estoque,Mínimo\n';
  const rows = Object.entries(materiais).map(([cod, m]) =>
    `"${cod}","${m.nome}","${m.categoria || ''}","${m.unidade}",${m.estoque},${m.minimo}`
  ).join('\n');
  const nome = 'almoxarifado_materiais_' + new Date().toISOString().slice(0, 10) + '.csv';
  downloadFile('\uFEFF' + header + rows, nome, 'text/csv;charset=utf-8;');
}

/** Abre o seletor de arquivo para importar CSV de materiais. */
function importarCSV() {
  document.getElementById('file-input').click();
}

/**
 * Processa o arquivo CSV selecionado e importa os materiais.
 * Colunas esperadas: Código, Nome, Categoria, Unidade, Estoque, Mínimo
 * @param {Event} event
 */
function processarCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function (e) {
    const lines = e.target.result
      .replace(/^\uFEFF/, '') // remove BOM
      .split('\n')
      .filter(l => l.trim());

    let importados = 0;
    let ignorados  = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(".*?"|[^,]+)/g);
      if (!cols || cols.length < 6) { ignorados++; continue; }

      const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());
      const [cod, nome, categoria, unidade, estoque, minimo] = clean;

      if (!cod || !nome)  { ignorados++; continue; }
      if (materiais[cod]) { ignorados++; continue; } // já existe

      materiais[cod] = {
        nome,
        categoria,
        unidade: unidade || 'un',
        estoque: parseInt(estoque) || 0,
        minimo:  parseInt(minimo)  || 5
      };
      importados++;
    }

    updateStats();
    renderCadastros();
    showAlert(
      `Importação concluída: <strong>${importados}</strong> materiais importados, ${ignorados} ignorados.`,
      'success',
      'cad-alert'
    );
  };

  reader.readAsText(file, 'UTF-8');
  event.target.value = ''; // permite reimportar o mesmo arquivo
}

/**
 * Cria e dispara o download de um arquivo.
 * @param {string} content  - Conteúdo do arquivo
 * @param {string} filename - Nome do arquivo gerado
 * @param {string} type     - MIME type
 */
function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Inicialização ----------
document.addEventListener('DOMContentLoaded', async () => {

    await testarConexao();

    await loadData();

    updateStats();
    renderRecentes();
    renderCadastros();
    renderEstoque();

    document.getElementById('scan-input')
        .addEventListener('keydown', function (e) {

            if (e.key === 'Enter')
                buscarCodigo();

        });

});