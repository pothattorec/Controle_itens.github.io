/* =============================================
   ALMOXARIFADO — Relatório Excel Profissional
   relatorio.js

   Personalize livremente este arquivo.
   Ele é independente do app.js.

   Depende de: SheetJS (xlsx.full.min.js)
   ============================================= */

// =============================================
//  PERSONALIZAÇÃO — mexa só aqui
// =============================================

const REL = {

  // ── Empresa ────────────────────────────────
  empresa:    'Real PVC',
  slogan:     'Controle de Materiais e Insumos',

  // ── Cores (formato HEX ARGB — sempre 8 dígitos) ──
  // Exemplos:
  //   Azul escuro  → 'FF1B3A6B'
  //   Azul médio   → 'FF2E6DA4'
  //   Azul claro   → 'FFD6E4F0'
  //   Cinza claro  → 'FFF2F2F2'
  //   Branco       → 'FFFFFFFF'
  //   Preto        → 'FF000000'
  //   Verde        → 'FF1E7145'
  //   Laranja      → 'FFED7D31'
  //   Vermelho     → 'FFC00000'

  cores: {
    cabecalho_fundo:  'FF1B3A6B',   // azul escuro — linha do título da empresa
    cabecalho_texto:  'FFFFFFFF',   // branco
    titulo_col_fundo: 'FF2E6DA4',   // azul médio — linha dos títulos das colunas
    titulo_col_texto: 'FFFFFFFF',   // branco
    linha_par:        'FFD6E4F0',   // azul bem claro — linhas alternadas
    linha_impar:      'FFFFFFFF',   // branco
    alerta_baixo:     'FFFFCCCC',   // rosa claro — estoque abaixo do mínimo
    alerta_texto:     'FFC00000',   // vermelho escuro
    total_fundo:      'FFF2F2F2',   // cinza claro — linha de totais
    total_texto:      'FF1B3A6B',   // azul escuro
    borda:            'FFB8CCE4',   // azul acinzentado
  },

  // ── Colunas da tabela de materiais ───────────
  // Reordene, remova ou renomeie à vontade.
  // Chaves disponíveis: nome, codigo, categoria, unidade, estoque, minimo,
  //                     entradas_mes, saidas_mes, status
  colunas: [
    { chave: 'nome',         titulo: 'Material',        largura: 40 },
    { chave: 'categoria',    titulo: 'Categoria',       largura: 20 },
    { chave: 'unidade',      titulo: 'Und.',            largura: 8  },
    { chave: 'estoque',      titulo: 'Estoque Atual',   largura: 15 },
    { chave: 'minimo',       titulo: 'Estoque Mín.',    largura: 13 },
    { chave: 'entradas_mes', titulo: 'Entradas Mês',    largura: 15 },
    { chave: 'saidas_mes',   titulo: 'Saídas Mês',      largura: 13 },
    { chave: 'status',       titulo: 'Status',          largura: 12 },
  ],

  // ── Linhas de resumo no final ─────────────────
  // Remova itens que não quiser exibir.
  resumo: [
    { label: 'Total de Itens',      chave: 'total_itens'   },
    { label: 'Total em Estoque',    chave: 'total_estoque' },
    { label: 'Entradas no Mês',     chave: 'total_entrada' },
    { label: 'Saídas no Mês',       chave: 'total_saida'   },
    { label: 'Itens com Estoque Baixo', chave: 'total_baixo' },
  ],

  // ── Aba da planilha ───────────────────────────
  nome_aba: 'Estoque Mensal',

  // ── Mostrar linha de assinatura no final? ─────
  mostrar_assinatura: true,
  texto_assinatura:   'Responsável pelo Almoxarifado: ___________________________',
};

// =============================================
//  GERADOR — não precisa mexer abaixo daqui
// =============================================

function exportarExcelMensal() {

  // ── Coleta dados ───────────────────────────────
  const agora    = new Date();
  const mes      = agora.getMonth();
  const ano      = agora.getFullYear();
  const nomeMes  = agora.toLocaleString('pt-BR', { month: 'long' });

  // Monta linhas de dados com totais do mês
  const linhas = [];
  let totalEstoque = 0, totalEntrada = 0, totalSaida = 0, totalBaixo = 0;

  Object.entries(materiais).forEach(([codigo, m]) => {
    let entradas = 0, saidas = 0;
    historico.forEach(r => {
      const d = new Date(r.ts);
      if (d.getMonth() === mes && d.getFullYear() === ano && r.codigo === codigo) {
        if (r.tipo === 'entrada') entradas += r.qty;
        if (r.tipo === 'saida')   saidas   += r.qty;
      }
    });
    const baixo = m.estoque <= m.minimo;
    totalEstoque += m.estoque;
    totalEntrada += entradas;
    totalSaida   += saidas;
    if (baixo) totalBaixo++;

    linhas.push({
      nome:         m.nome,
      codigo,
      categoria:    m.categoria || '—',
      unidade:      m.unidade,
      estoque:      m.estoque,
      minimo:       m.minimo,
      entradas_mes: entradas,
      saidas_mes:   saidas,
      status:       baixo ? '⚠ Baixo' : '✓ OK',
      _baixo:       baixo,   // controle interno de cor
    });
  });

  const totais = {
    total_itens:   linhas.length,
    total_estoque: totalEstoque,
    total_entrada: totalEntrada,
    total_saida:   totalSaida,
    total_baixo:   totalBaixo,
  };

  // ── Cria workbook ──────────────────────────────
  const wb = XLSX.utils.book_new();
  const ws = {};
  let linha = 1; // 1-based para SheetJS

  // ── Bloco 1: Cabeçalho da empresa ─────────────
  // Linha 1: Nome da empresa (mesclada)
  _cel(ws, linha, 1, REL.empresa, {
    bold: true, sz: 18,
    fgColor: REL.cores.cabecalho_fundo,
    fontColor: REL.cores.cabecalho_texto,
    halign: 'center',
    valign: 'center'
  });
  _mesclar(ws, linha, 1, linha, REL.colunas.length);
  linha++;

  // Linha 2: Slogan
  _cel(ws, linha, 1, REL.slogan, {
    sz: 11, italic: true,
    fgColor: REL.cores.cabecalho_fundo,
    fontColor: REL.cores.cabecalho_texto,
    halign: 'center',
    valign: 'center'
  });
  _mesclar(ws, linha, 1, linha, REL.colunas.length);
  linha++;

  // Linha 3: vazia
  linha++;

  // ── Bloco 2: Informações do relatório ──────────
  const infos = [
    ['Relatório:', `Estoque Mensal — ${nomeMes.charAt(0).toUpperCase() + nomeMes.slice(1)} / ${ano}`],
    ['Emitido em:', agora.toLocaleDateString('pt-BR') + ' às ' + agora.toLocaleTimeString('pt-BR')],
    ['Empresa:', REL.empresa],
  ];

  infos.forEach(([label, valor]) => {
    _cel(ws, linha, 1, label, { bold: true, sz: 10 });
    _cel(ws, linha, 2, valor,  { sz: 10 });
    _mesclar(ws, linha, 2, linha, 4);
    linha++;
  });
  linha++; // espaço

  // ── Bloco 3: Títulos das colunas ───────────────
  const linhaHeader = linha;
  REL.colunas.forEach((col, i) => {
    _cel(ws, linha, i + 1, col.titulo, {
      bold: true, sz: 11,
      fgColor: REL.cores.titulo_col_fundo,
      fontColor: REL.cores.titulo_col_texto,
      halign: 'center',
      borda: true,
    });
  });
  linha++;

  // ── Bloco 4: Dados dos materiais ───────────────
  const linhaInicioDados = linha;
  linhas.forEach((row, idx) => {
    const par   = idx % 2 === 0;
    const fundo = row._baixo
      ? REL.cores.alerta_baixo
      : (par ? REL.cores.linha_par : REL.cores.linha_impar);
    const fontColor = row._baixo ? REL.cores.alerta_texto : 'FF000000';

    REL.colunas.forEach((col, i) => {
      let valor = row[col.chave] ?? '';
      _cel(ws, linha, i + 1, valor, {
        sz: 10,
        fgColor: fundo,
        fontColor,
        halign: (typeof valor === 'number') ? 'right' : 'left',
        borda: true,
        bold: row._baixo,
      });
    });
    linha++;
  });

  // ── Bloco 5: Linha de totais ───────────────────
  linha++; // espaço
  _cel(ws, linha, 1, 'RESUMO DO PERÍODO', {
    bold: true, sz: 11,
    fgColor: REL.cores.titulo_col_fundo,
    fontColor: REL.cores.titulo_col_texto,
  });
  _mesclar(ws, linha, 1, linha, REL.colunas.length);
  linha++;

  REL.resumo.forEach(item => {
    _cel(ws, linha, 1, item.label, {
      bold: true, sz: 10,
      fgColor: REL.cores.total_fundo,
      fontColor: REL.cores.total_texto,
    });
    _cel(ws, linha, 2, totais[item.chave], {
      sz: 10, bold: true,
      fgColor: REL.cores.total_fundo,
      fontColor: REL.cores.total_texto,
      halign: 'right',
    });
    linha++;
  });

  // ── Bloco 6: Assinatura ────────────────────────
  if (REL.mostrar_assinatura) {
    linha += 2;
    _cel(ws, linha, 1, REL.texto_assinatura, { sz: 10, italic: true });
    _mesclar(ws, linha, 1, linha, REL.colunas.length);
    linha++;
    _cel(ws, linha, 1,
      agora.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
      { sz: 10, italic: true });
    _mesclar(ws, linha, 1, linha, REL.colunas.length);
  }

  // ── Largura das colunas ────────────────────────
  ws['!cols'] = REL.colunas.map(c => ({ wch: c.largura }));

  // ── Dimensão da planilha ───────────────────────
  ws['!ref'] = XLSX.utils.encode_range(
    { r: 0, c: 0 },
    { r: linha, c: REL.colunas.length - 1 }
  );

  // ── Salva ──────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, ws, REL.nome_aba);
  XLSX.writeFile(wb, `Estoque_${ano}_${String(mes + 1).padStart(2,'0')}.xlsx`);
}

// =============================================
//  HELPERS INTERNOS
// =============================================

/**
 * Escreve uma célula com estilo completo.
 * @param {object} ws        - Worksheet SheetJS
 * @param {number} row       - Linha (1-based)
 * @param {number} col       - Coluna (1-based)
 * @param {*}      valor     - Conteúdo da célula
 * @param {object} estilo    - Opções de estilo
 */
function _cel(ws, row, col, valor, estilo = {}) {
  const addr = XLSX.utils.encode_cell({ r: row - 1, c: col - 1 });

  const tipo = typeof valor === 'number' ? 'n' : 's';

  ws[addr] = {
    v: valor,
    t: tipo,
    s: {
      font: {
        name:   'Calibri',
        sz:     estilo.sz     || 10,
        bold:   estilo.bold   || false,
        italic: estilo.italic || false,
        color:  estilo.fontColor ? { rgb: estilo.fontColor } : { rgb: 'FF000000' },
      },
      fill: estilo.fgColor ? {
        patternType: 'solid',
        fgColor: { rgb: estilo.fgColor },
      } : undefined,
      alignment: {
        horizontal: estilo.halign  || 'left',
        vertical:   'center',
        wrapText:   true,
      },
      border: estilo.borda ? {
        top:    { style: 'thin', color: { rgb: REL.cores.borda } },
        bottom: { style: 'thin', color: { rgb: REL.cores.borda } },
        left:   { style: 'thin', color: { rgb: REL.cores.borda } },
        right:  { style: 'thin', color: { rgb: REL.cores.borda } },
      } : undefined,
    },
  };
}

/**
 * Registra mesclagem de células.
 */
function _mesclar(ws, r1, c1, r2, c2) {
  if (!ws['!merges']) ws['!merges'] = [];
  ws['!merges'].push({
    s: { r: r1 - 1, c: c1 - 1 },
    e: { r: r2 - 1, c: c2 - 1 },
  });
}
