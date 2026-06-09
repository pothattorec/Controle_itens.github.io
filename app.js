/* =============================================
   ALMOXARIFADO — Lógica principal
   app.js

   Detecta automaticamente em qual página está:
   - scanner.html  → Scanner + Cadastro
   - estoque.html  → Estoque + Histórico
   - futuro.html   → placeholder
   ============================================= */

// ---------- Estado global ----------
let materiais = {};
let historico  = [];
let hoje       = { entradas: 0, saidas: 0 };
let itemAtual  = null;

const PAGINA = window.location.pathname.split('/').pop() || 'scanner.html';

// ============================================================
// DADOS — carrega tudo do Supabase
// ============================================================

async function loadData() {
  try {
    const { data: matDB, error: errMat } = await db
      .from('materiais').select('*').order('nome');
    if (errMat) throw errMat;

    materiais = {};
    matDB.forEach(item => {
      materiais[item.codigo] = {
        nome:      item.nome,
        categoria: item.categoria,
        unidade:   item.unidade,
        estoque:   item.estoque,
        minimo:    item.minimo
      };
    });

    const { data: histDB, error: errHist } = await db
      .from('historico').select('*')
      .order('criado_em', { ascending: false }).limit(500);
    if (errHist) throw errHist;

    historico = histDB.map(item => ({
      codigo:  item.codigo,
      nome:    item.nome,
      qty:     item.qty,
      tipo:    item.tipo,
      resp:    item.resp,
      unidade: item.unidade,
      ts:      item.criado_em
    }));

    const hojeStr = new Date().toDateString();
    hoje.entradas = historico
      .filter(r => r.tipo === 'entrada' && new Date(r.ts).toDateString() === hojeStr)
      .reduce((a, b) => a + b.qty, 0);
    hoje.saidas = historico
      .filter(r => r.tipo === 'saida' && new Date(r.ts).toDateString() === hojeStr)
      .reduce((a, b) => a + b.qty, 0);

  } catch (err) {
    console.error('Erro ao carregar dados:', err);
  }
}

async function carregarMateriais(render) {
  await loadData(); updateStats();
  if (render) renderEstoque();
}

async function carregarRecentes() {
  await loadData(); updateStats(); renderRecentes();
}

async function carregarHistorico(render) {
  await loadData();
  if (render) renderHistorico();
}

// ============================================================
// UI — Utilitários
// ============================================================

function showTab(tab, btn) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  btn.classList.add('active');

  if (tab === 'estoque')   renderEstoque();
  if (tab === 'historico') renderHistorico();
  if (tab === 'cadastro')  renderCadastros();
  if (tab === 'scanner')   setTimeout(() => document.getElementById('scan-input')?.focus(), 50);
}

function updateStats() {
  const total = Object.keys(materiais).length;
  const baixo = Object.values(materiais).filter(m => m.estoque <= m.minimo).length;
  document.getElementById('stat-total').textContent    = total;
  document.getElementById('stat-entradas').textContent = hoje.entradas;
  document.getElementById('stat-saidas').textContent   = hoje.saidas;
  document.getElementById('stat-baixo').textContent    = baixo;
}

function showAlert(msg, tipo, elemId) {
  const el = document.getElementById(elemId || 'alert-box');
  if (!el) return;
  const icon = tipo === 'success' ? 'circle-check' : 'alert-triangle';
  el.className = 'alert show alert-' + tipo;
  el.innerHTML = `<i class="ti ti-${icon}"></i> ${msg}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ============================================================
// SCANNER
// ============================================================

function buscarCodigo() {
  const cod = document.getElementById('scan-input').value.trim();
  if (!cod) return;

  const mat     = materiais[cod];
  const preview = document.getElementById('preview-box');

  if (!mat) {
    preview.classList.remove('show');
    showAlert(`Código <strong>${cod}</strong> não encontrado. Vá em Cadastro para adicionar.`, 'danger');
    return;
  }

  itemAtual = cod;
  document.getElementById('preview-nome').textContent = mat.nome;
  document.getElementById('preview-info').innerHTML =
    `Código: <span style="font-family:var(--font-mono)">${cod}</span>
     &nbsp;|&nbsp; Estoque atual: <strong>${mat.estoque} ${mat.unidade}</strong>
     &nbsp;|&nbsp; Categoria: ${mat.categoria || '—'}`;
  document.getElementById('qty-input').value  = 1;
  document.getElementById('resp-input').value = '';
  preview.classList.add('show');
  document.getElementById('qty-input').focus();
}

async function registrar(tipo) {
  if (!itemAtual) return;

  const qty  = parseInt(document.getElementById('qty-input').value) || 1;
  const resp = document.getElementById('resp-input').value.trim() || 'Não informado';
  const mat  = materiais[itemAtual];

  if (tipo === 'saida' && mat.estoque < qty) {
    showAlert(`Estoque insuficiente! Disponível: <strong>${mat.estoque} ${mat.unidade}</strong>`, 'danger');
    return;
  }

  showAlert(`Registrando ${tipo}...`, 'success');

  let sucesso = tipo === 'entrada'
    ? await registrarEntrada(itemAtual, qty, resp)
    : await registrarSaida(itemAtual, qty, resp);

  if (!sucesso) {
    showAlert('Erro ao registrar. Verifique a conexão com o banco.', 'danger');
    return;
  }

  await loadData();
  updateStats();
  renderRecentes();

  const label = tipo === 'entrada' ? '✓ Entrada' : '✓ Saída';
  showAlert(`${label} de <strong>${qty} ${mat.unidade}</strong> — ${mat.nome}`, 'success');

  document.getElementById('scan-input').value = '';
  document.getElementById('preview-box').classList.remove('show');
  document.getElementById('scan-input').focus();
  itemAtual = null;
}

function renderRecentes() {
  const tb = document.getElementById('tb-recentes');
  if (!tb) return;
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

// ============================================================
// ESTOQUE
// ============================================================

function renderEstoque() {
  const tb = document.getElementById('tb-estoque');
  if (!tb) return;

  const busca  = (document.getElementById('search-estoque')?.value || '').toLowerCase();
  const filtro = document.getElementById('filter-estoque')?.value || '';

  let items = Object.entries(materiais);
  if (busca)          items = items.filter(([c, m]) =>
    m.nome.toLowerCase().includes(busca) || c.includes(busca) ||
    (m.categoria || '').toLowerCase().includes(busca));
  if (filtro === 'baixo') items = items.filter(([, m]) => m.estoque <= m.minimo);
  if (filtro === 'ok')    items = items.filter(([, m]) => m.estoque >  m.minimo);

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="6" class="empty">Nenhum material encontrado</td></tr>';
    return;
  }

  tb.innerHTML = items.map(([cod, m]) => {
    const baixo = m.estoque <= m.minimo;
    const badge = baixo
      ? '<span class="badge badge-warning">⚠ Baixo</span>'
      : '<span class="badge badge-success">OK</span>';
    const qtdStyle = baixo ? 'style="color:var(--warning-text);font-weight:600;"' : '';
    return `<tr class="${baixo ? 'low-stock' : ''}">
      <td>${m.nome}</td>
      <td style="text-align:center;">${m.categoria || '—'}</td>
      <td style="text-align:center;" ${qtdStyle}>${m.estoque}</td>
      <td style="text-align:center;">${m.minimo}</td>
      <td style="text-align:center;">${m.unidade}</td>
      <td style="text-align:center;">${badge}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// CADASTRO
// ============================================================

async function cadastrar() {
  if (!verificarAdmin()) {
    alert('Acesso restrito. Faça login como administrador.');
    return;
  }

  const cod      = document.getElementById('cad-codigo').value.trim();
  const nome     = document.getElementById('cad-nome').value.trim();
  const categoria = document.getElementById('cad-categoria').value.trim();
  const unidade  = document.getElementById('cad-unidade').value;
  const estoque  = parseInt(document.getElementById('cad-estoque').value) || 0;
  const minimo   = parseInt(document.getElementById('cad-minimo').value)  || 5;

  if (!cod || !nome) {
    showAlert('Código e nome são obrigatórios.', 'danger', 'cad-alert');
    return;
  }

  const { error } = await db
    .from('materiais')
    .insert([{ codigo: cod, nome, categoria, unidade, estoque, minimo }]);

  if (error) {
    showAlert(error.message, 'danger', 'cad-alert');
    return;
  }

  await loadData();
  updateStats();
  renderCadastros();
  showAlert('Material cadastrado com sucesso.', 'success', 'cad-alert');
  limparForm();
}

function limparForm() {
  ['cad-codigo', 'cad-nome', 'cad-categoria'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('cad-estoque').value = '0';
  document.getElementById('cad-minimo').value  = '5';
  document.getElementById('cad-unidade').value = 'un';
}

function renderCadastros() {
  const tb = document.getElementById('tb-cadastros');
  if (!tb) return;

  const items = Object.entries(materiais);
  document.getElementById('total-cad').textContent = items.length;

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
        <button onclick="imprimirEtiqueta('${cod}')" title="Imprimir etiqueta"><i class="ti ti-printer"></i></button>
        <button onclick="editarItem('${cod}')" title="Editar" style="margin-left:4px;"><i class="ti ti-edit"></i></button>
        <button onclick="deletar('${cod}')" title="Remover" style="margin-left:4px;"><i class="ti ti-trash"></i></button>
      </td>
    </tr>`).join('');
}

async function editarItem(cod) {
  if (!verificarAdmin()) { alert('Acesso restrito.'); return; }
  const m = materiais[cod];
  const nome     = prompt('Nome:', m.nome);       if (nome     === null) return;
  const categoria = prompt('Categoria:', m.categoria || ''); if (categoria === null) return;
  const unidade  = prompt('Unidade:', m.unidade); if (unidade  === null) return;
  const estoque  = prompt('Estoque:', m.estoque); if (estoque  === null) return;
  const minimo   = prompt('Mínimo:', m.minimo);   if (minimo   === null) return;

  const { error } = await db.from('materiais')
    .update({ nome, categoria, unidade, estoque: Number(estoque), minimo: Number(minimo) })
    .eq('codigo', cod);

  if (error) { alert(error.message); return; }
  await loadData(); updateStats(); renderCadastros();
}

async function deletar(cod) {
  if (!verificarAdmin()) { alert('Acesso restrito.'); return; }
  if (!confirm(`Remover "${materiais[cod].nome}"?`)) return;
  const { error } = await db.from('materiais').delete().eq('codigo', cod);
  if (error) { alert(error.message); return; }
  await loadData(); updateStats(); renderCadastros();
}

// ============================================================
// HISTÓRICO
// ============================================================

function renderHistorico() {
  const tb = document.getElementById('tb-historico');
  if (!tb) return;

  const tipo  = document.getElementById('hist-tipo')?.value  || '';
  const busca = (document.getElementById('hist-busca')?.value || '').toLowerCase();

  let items = [...historico];
  if (tipo)  items = items.filter(r => r.tipo === tipo);
  if (busca) items = items.filter(r =>
    r.nome.toLowerCase().includes(busca) ||
    r.resp.toLowerCase().includes(busca) ||
    r.codigo.toLowerCase().includes(busca));

  if (!items.length) {
    tb.innerHTML = '<tr><td colspan="5" class="empty">Nenhum registro encontrado</td></tr>';
    return;
  }

  tb.innerHTML = items.map(r => {
    const d  = new Date(r.ts);
    const dt = d.toLocaleDateString('pt-BR') + ' ' +
               d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    const badge = r.tipo === 'entrada'
      ? '<span class="badge badge-success">↓ Entrada</span>'
      : '<span class="badge badge-danger">↑ Saída</span>';
    return `<tr>
      <td style="font-size:12px;white-space:nowrap;text-align:center;">${dt}</td>
      <td>${r.nome}</td>
      <td style="text-align:center;">${r.qty} ${r.unidade || ''}</td>
      <td style="text-align:center;">${badge}</td>
      <td style="text-align:center;">${r.resp}</td>
    </tr>`;
  }).join('');
}

// ============================================================
// EXPORTAR / IMPORTAR
// ============================================================

function exportarCSV() {
  if (!historico.length) { alert('Nenhum registro para exportar.'); return; }
  const header = 'Data/Hora,Código,Material,Quantidade,Unidade,Tipo,Responsável\n';
  const rows = historico.map(r => {
    const d = new Date(r.ts).toLocaleString('pt-BR');
    return `"${d}","${r.codigo}","${r.nome}",${r.qty},"${r.unidade || ''}","${r.tipo}","${r.resp}"`;
  }).join('\n');
  _downloadFile('\uFEFF' + header + rows,
    'historico_' + new Date().toISOString().slice(0, 10) + '.csv',
    'text/csv;charset=utf-8;');
}

function exportarMateriais() {
  if (!Object.keys(materiais).length) { alert('Nenhum material para exportar.'); return; }
  const header = 'Código,Nome,Categoria,Unidade,Estoque,Mínimo\n';
  const rows = Object.entries(materiais).map(([cod, m]) =>
    `"${cod}","${m.nome}","${m.categoria || ''}","${m.unidade}",${m.estoque},${m.minimo}`
  ).join('\n');
  _downloadFile('\uFEFF' + header + rows,
    'materiais_' + new Date().toISOString().slice(0, 10) + '.csv',
    'text/csv;charset=utf-8;');
}

function importarCSV() { document.getElementById('file-input').click(); }

async function processarCSV(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(e) {
    const lines = e.target.result.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
    let importados = 0, ignorados = 0;
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(".*?"|[^,]+)/g);
      if (!cols || cols.length < 6) { ignorados++; continue; }
      const [cod, nome, categoria, unidade, estoque, minimo] = cols.map(c => c.replace(/^"|"$/g, '').trim());
      if (!cod || !nome || materiais[cod]) { ignorados++; continue; }
      const { error } = await db.from('materiais')
        .insert([{ codigo: cod, nome, categoria, unidade: unidade || 'un',
                   estoque: parseInt(estoque) || 0, minimo: parseInt(minimo) || 5 }]);
      if (error) { ignorados++; continue; }
      importados++;
    }
    await loadData(); updateStats(); renderCadastros();
    showAlert(`Importação: <strong>${importados}</strong> importados, ${ignorados} ignorados.`, 'success', 'cad-alert');
  };
  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

// ============================================================
// IMPRESSORA — modal de impressão
// ============================================================

function imprimirEtiqueta(cod) {
  const m = materiais[cod];
  if (!m) { alert('Material não encontrado.'); return; }

  document.getElementById('modal-impressao')?.remove();
  const modal = document.createElement('div');
  modal.id = 'modal-impressao';
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.45);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:1rem;
  `;
  modal.innerHTML = `
    <div style="background:var(--bg-primary); border-radius:var(--radius-lg);
                padding:1.5rem; width:100%; max-width:420px;
                border:0.5px solid var(--border); box-shadow:0 8px 32px rgba(0,0,0,0.18);">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:1rem;">
        <i class="ti ti-printer" style="font-size:22px; color:var(--info-text);"></i>
        <strong style="font-size:16px;">Imprimir Etiqueta</strong>
      </div>
      <div style="background:var(--bg-secondary); border-radius:var(--radius-md);
                  padding:12px; margin-bottom:1rem; font-size:13px; line-height:1.7;">
        <div><strong>Código:</strong> <span style="font-family:var(--font-mono)">${cod}</span></div>
        <div><strong>Material:</strong> ${m.nome}</div>
        <div><strong>Categoria:</strong> ${m.categoria || '—'}</div>
      </div>
      <div style="margin-bottom:1.25rem;">
        <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">Cópias</label>
        <input type="number" id="imp-copias" value="1" min="1" max="99"
          style="width:100%; padding:8px 12px; border:0.5px solid var(--border-md);
                 border-radius:var(--radius-md); font-size:14px;
                 background:var(--bg-primary); color:var(--text-primary);" />
      </div>
      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button onclick="document.getElementById('modal-impressao').remove()"
          style="padding:9px 18px; border:0.5px solid var(--border-md);
                 background:var(--bg-primary); border-radius:var(--radius-md);
                 cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-x"></i>Cancelar
        </button>
        <button onclick="_confirmarImpressao('${cod}')"
          style="padding:9px 18px; background:var(--info-bg); border:0.5px solid var(--info-border);
                 color:var(--info-text); border-radius:var(--radius-md); cursor:pointer;
                 font-size:13px; font-weight:600; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-printer"></i>Imprimir
        </button>
      </div>
    </div>
  `;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
  document.getElementById('imp-copias').focus();
}

async function _confirmarImpressao(cod) {
  const copias = parseInt(document.getElementById('imp-copias').value) || 1;
  const m = materiais[cod];
  const { error } = await db.from('fila_impressao')
    .insert([{ codigo: cod, nome: m.nome, copias, status: 'pendente' }]);
  document.getElementById('modal-impressao').remove();
  if (error) {
    showAlert('Erro ao enviar para fila de impressão.', 'danger');
  } else {
    showAlert(`🖨 Enviado para impressão: <strong>${copias}× ${m.nome}</strong>`, 'success');
  }
}

// ============================================================
// INICIALIZAÇÃO — detecta a página automaticamente
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  await testarConexao();
  await loadData();
  updateStats();

  // ── scanner.html ──
  if (PAGINA === 'scanner.html' || PAGINA === '') {
    renderRecentes();
    renderCadastros();

    document.getElementById('scan-input')
      ?.addEventListener('keydown', e => { if (e.key === 'Enter') buscarCodigo(); });

    // Aba de cadastro só aparece para admin
    const btnCadastro = document.getElementById('tab-btn-cadastro');
    if (btnCadastro && !verificarAdmin()) {
      btnCadastro.style.display = 'none';
    }

    if (typeof conectarImpressora === 'function') conectarImpressora();
  }

  // ── estoque.html ──
  if (PAGINA === 'estoque.html') {
    renderEstoque();
    renderHistorico();
  }

});
