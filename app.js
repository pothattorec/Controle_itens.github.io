/* =============================================
   ALMOXARIFADO — Lógica principal
   app.js  (corrigido)

   BUGS CORRIGIDOS:
   1. registrar() agora chama o Supabase (registrarEntrada/registrarSaida)
      em vez de só atualizar a memória local.
   2. Após registrar, recarrega os dados do banco para garantir
      sincronia entre todos os dispositivos.
   3. imprimirEtiqueta() adicionada (estava referenciada mas não existia).
   4. processarCSV() agora salva no Supabase, não só em memória.
   5. carregarRecentes() e carregarHistorico() expostas globalmente
      (eram chamadas no HTML mas não existiam).
   ============================================= */

// ---------- Estado global ----------
let materiais = {};
let historico  = [];
let hoje       = { entradas: 0, saidas: 0 };
let itemAtual  = null;

// ============================================================
// DADOS — carrega tudo do Supabase
// ============================================================

async function loadData() {
  try {
    // --- Materiais ---
    const { data: matDB, error: errMat } = await db
      .from('materiais')
      .select('*')
      .order('nome');

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

    // --- Histórico ---
    const { data: histDB, error: errHist } = await db
      .from('historico')
      .select('*')
      .order('criado_em', { ascending: false })
      .limit(500);

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

    // --- Totais do dia ---
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

// Alias usados por botões de "Atualizar" no HTML
async function carregarMateriais(render) {
  await loadData();
  updateStats();
  if (render) renderEstoque();
}

async function carregarRecentes() {
  await loadData();
  updateStats();
  renderRecentes();
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
  if (tab === 'scanner')   setTimeout(() => document.getElementById('scan-input').focus(), 50);
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
  const el   = document.getElementById(elemId || 'alert-box');
  const icon = tipo === 'success' ? 'circle-check' : 'alert-triangle';
  el.className = 'alert show alert-' + tipo;
  el.innerHTML = `<i class="ti ti-${icon}"></i> ${msg}`;
  setTimeout(() => el.classList.remove('show'), 3500);
}

// ============================================================
// SCANNER — busca e registro
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

/**
 * ✅ BUG 1 CORRIGIDO — agora salva no Supabase via database.js
 * e recarrega os dados para sincronizar todos os dispositivos.
 */
async function registrar(tipo) {

  if (!itemAtual) return;

  const qty  = parseInt(document.getElementById('qty-input').value) || 1;
  const resp = document.getElementById('resp-input').value.trim() || 'Não informado';
  const mat  = materiais[itemAtual];

  // Validação de estoque para saída
  if (tipo === 'saida' && mat.estoque < qty) {
    showAlert(`Estoque insuficiente! Disponível: <strong>${mat.estoque} ${mat.unidade}</strong>`, 'danger');
    return;
  }

  // Feedback visual imediato
  const label = tipo === 'entrada' ? '✓ Entrada' : '✓ Saída';
  showAlert(`Registrando ${tipo}...`, 'success');

  // ✅ Chama as funções corretas do database.js que gravam no Supabase
  let sucesso;
  if (tipo === 'entrada') {
    sucesso = await registrarEntrada(itemAtual, qty, resp);
  } else {
    sucesso = await registrarSaida(itemAtual, qty, resp);
  }

  if (!sucesso) {
    showAlert('Erro ao registrar. Verifique a conexão com o banco.', 'danger');
    return;
  }

  // Recarrega do banco para garantir sincronia com outros dispositivos
  await loadData();
  updateStats();
  renderRecentes();

  showAlert(`${label} de <strong>${qty} ${mat.unidade}</strong> — ${mat.nome}`, 'success');

  // Limpa e devolve foco
  document.getElementById('scan-input').value = '';
  document.getElementById('preview-box').classList.remove('show');
  document.getElementById('scan-input').focus();
  itemAtual = null;
}

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

// ============================================================
// ESTOQUE
// ============================================================

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
    console.error(error);
    showAlert(error.message, 'danger', 'cad-alert');
    return;
  }

  await loadData();
  updateStats();
  renderCadastros();
  renderEstoque();
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
        <button onclick="imprimirEtiqueta('${cod}')" title="Imprimir etiqueta" style="margin-left:4px;"><i class="ti ti-printer"></i></button>
      </td>
    </tr>`).join('');
}

async function editarItem(cod) {

  if (!verificarAdmin()) {
    alert('Acesso restrito.');
    return;
  }

  const m = materiais[cod];

  const nome     = prompt('Nome:',      m.nome);      if (nome     === null) return;
  const categoria = prompt('Categoria:', m.categoria || ''); if (categoria === null) return;
  const unidade  = prompt('Unidade:',   m.unidade);   if (unidade  === null) return;
  const estoque  = prompt('Estoque:',   m.estoque);   if (estoque  === null) return;
  const minimo   = prompt('Mínimo:',    m.minimo);    if (minimo   === null) return;

  const { error } = await db
    .from('materiais')
    .update({ nome, categoria, unidade, estoque: Number(estoque), minimo: Number(minimo) })
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
    alert('Acesso restrito.');
    return;
  }

  if (!confirm(`Remover "${materiais[cod].nome}" do cadastro?`)) return;

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
}

// ============================================================
// HISTÓRICO
// ============================================================

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
    const dt = d.toLocaleDateString('pt-BR') + ' ' +
               d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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
  downloadFile('\uFEFF' + header + rows,
    'almoxarifado_historico_' + new Date().toISOString().slice(0, 10) + '.csv',
    'text/csv;charset=utf-8;');
}

function exportarMateriais() {
  if (!Object.keys(materiais).length) { alert('Nenhum material para exportar.'); return; }
  const header = 'Código,Nome,Categoria,Unidade,Estoque,Mínimo\n';
  const rows = Object.entries(materiais).map(([cod, m]) =>
    `"${cod}","${m.nome}","${m.categoria || ''}","${m.unidade}",${m.estoque},${m.minimo}`
  ).join('\n');
  downloadFile('\uFEFF' + header + rows,
    'almoxarifado_materiais_' + new Date().toISOString().slice(0, 10) + '.csv',
    'text/csv;charset=utf-8;');
}

function importarCSV() {
  document.getElementById('file-input').click();
}

/**
 * ✅ BUG 4 CORRIGIDO — agora salva cada material no Supabase,
 * não só em memória local.
 */
async function processarCSV(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = async function (e) {
    const lines = e.target.result
      .replace(/^\uFEFF/, '')
      .split('\n')
      .filter(l => l.trim());

    let importados = 0;
    let ignorados  = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].match(/(".*?"|[^,]+)/g);
      if (!cols || cols.length < 6) { ignorados++; continue; }

      const clean = cols.map(c => c.replace(/^"|"$/g, '').trim());
      const [cod, nome, categoria, unidade, estoque, minimo] = clean;

      if (!cod || !nome)   { ignorados++; continue; }
      if (materiais[cod])  { ignorados++; continue; }

      const { error } = await db
        .from('materiais')
        .insert([{
          codigo:   cod,
          nome,
          categoria,
          unidade:  unidade || 'un',
          estoque:  parseInt(estoque) || 0,
          minimo:   parseInt(minimo)  || 5
        }]);

      if (error) { ignorados++; continue; }
      importados++;
    }

    await loadData();
    updateStats();
    renderCadastros();
    showAlert(
      `Importação concluída: <strong>${importados}</strong> materiais importados, ${ignorados} ignorados.`,
      'success', 'cad-alert'
    );
  };

  reader.readAsText(file, 'UTF-8');
  event.target.value = '';
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ============================================================
// IMPRESSORA ZEBRA — modal de configuração antes de imprimir
// ============================================================

/**
 * Abre um modal de confirmação antes de imprimir.
 * Permite escolher a quantidade de cópias e pré-visualizar o ZPL.
 * A impressão em si é delegada ao Impressora.js.
 *
 * @param {string} cod - Código de barras do material
 */
function imprimirEtiqueta(cod) {

  const m = materiais[cod];
  if (!m) { alert('Material não encontrado.'); return; }

  // Remove modal anterior se existir
  document.getElementById('modal-impressao')?.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-impressao';
  modal.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.45);
    display:flex; align-items:center; justify-content:center;
    z-index:9999; padding:1rem;
  `;

  modal.innerHTML = `
    <div style="
      background:var(--bg-primary); border-radius:var(--radius-lg);
      padding:1.5rem; width:100%; max-width:420px;
      border:0.5px solid var(--border); box-shadow:0 8px 32px rgba(0,0,0,0.18);
    ">
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

      <!-- Pré-visualização da etiqueta -->
      <div style="margin-bottom:1rem;">
        <div style="font-size:12px; color:var(--text-secondary); font-weight:600; margin-bottom:6px;">
          PRÉ-VISUALIZAÇÃO
        </div>
        <div id="preview-etiqueta" style="
          border:1.5px dashed var(--border-md); border-radius:var(--radius-md);
          padding:12px; background:#fff; color:#000;
          font-family:'Courier New',monospace; font-size:11px;
          display:flex; flex-direction:column; align-items:center; gap:6px;
          min-height:90px;
        ">
          <div style="
            background:repeating-linear-gradient(90deg,#000 0px,#000 2px,#fff 2px,#fff 5px);
            width:140px; height:48px; border-radius:2px;
          "></div>
          <div style="font-size:12px; letter-spacing:2px;">${cod}</div>
          <div style="font-size:13px; font-weight:bold; font-family:sans-serif; text-align:center;">${m.nome}</div>
        </div>
      </div>

      <!-- Configurações -->
      <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:1.25rem;">
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">
            Cópias
          </label>
          <input type="number" id="imp-copias" value="1" min="1" max="99"
            style="width:100%; padding:8px 12px; border:0.5px solid var(--border-md);
                   border-radius:var(--radius-md); font-size:14px; background:var(--bg-primary); color:var(--text-primary);" />
        </div>
        <div>
          <label style="font-size:12px; font-weight:600; color:var(--text-secondary); display:block; margin-bottom:4px;">
            Tamanho (mm)
          </label>
          <select id="imp-tamanho"
            style="width:100%; padding:8px 12px; border:0.5px solid var(--border-md);
                   border-radius:var(--radius-md); font-size:13px; background:var(--bg-primary); color:var(--text-primary);">
            <option value="60x30" selected>60 × 30 mm</option>
            <option value="80x40">80 × 40 mm</option>
            <option value="100x50">100 × 50 mm</option>
            <option value="50x25">50 × 25 mm</option>
            <option value="40x25">40 × 25 mm</option>
          </select>
        </div>
      </div>

      <!-- Botões -->
      <div style="display:flex; gap:8px; justify-content:flex-end; flex-wrap:wrap;">
        <button onclick="document.getElementById('modal-impressao').remove()"
          style="padding:9px 18px; border:0.5px solid var(--border-md);
                 background:var(--bg-primary); border-radius:var(--radius-md);
                 cursor:pointer; font-size:13px; display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-x"></i>Cancelar
        </button>
        <button onclick="_confirmarImpressao('${cod}')"
          style="padding:9px 18px; background:var(--info-bg); border:0.5px solid var(--info-border);
                 color:var(--info-text); border-radius:var(--radius-md);
                 cursor:pointer; font-size:13px; font-weight:600;
                 display:inline-flex; align-items:center; gap:6px;">
          <i class="ti ti-printer"></i>Imprimir
        </button>
      </div>
    </div>
  `;

  // Fecha clicando fora
  modal.addEventListener('click', e => {
    if (e.target === modal) modal.remove();
  });

  document.body.appendChild(modal);
  document.getElementById('imp-copias').focus();
}

/**
 * Lê as configurações do modal e chama o Impressora.js.
 */
function _confirmarImpressao(cod) {
  const copias   = parseInt(document.getElementById('imp-copias').value) || 1;
  const tamanho  = document.getElementById('imp-tamanho').value; // ex: "60x30"
  const [larg, alt] = tamanho.split('x').map(Number);

  // Aplica o tamanho escolhido no objeto global do Impressora.js
  if (typeof ETIQUETA !== 'undefined') {
    ETIQUETA.largura_mm = larg;
    ETIQUETA.altura_mm  = alt;
    ETIQUETA.copias     = copias;
  }

  document.getElementById('modal-impressao').remove();

  // Delega para o Impressora.js (que gera o ZPL e envia para a Zebra)
  if (typeof gerarZPL !== 'undefined' && typeof _enviarParaImpressora !== 'undefined') {
    const m   = materiais[cod];
    const zpl = gerarZPL(cod, m.nome, copias);
    _enviarParaImpressora(zpl, `${copias}× ${m.nome}`);
  } else {
    alert('Impressora.js não carregado. Verifique se o arquivo está incluído no index.html.');
  }
}

// ============================================================
// INICIALIZAÇÃO
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {

  await testarConexao();
  await loadData();

  updateStats();
  renderRecentes();
  renderCadastros();
  renderEstoque();
  conectarImpressora();

  document.getElementById('scan-input')
    .addEventListener('keydown', e => {
      if (e.key === 'Enter') buscarCodigo();
    });

});
