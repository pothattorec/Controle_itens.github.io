/* =============================================
   ALMOXARIFADO — Impressão de Etiquetas Zebra
   Impressora.js

   Impressora detectada: Zebra ZT230-200dpi ZPL
   Número de série USB: 52n210300332
   DPI: 200 → 1 mm = 8 dots

   Requer: Zebra Browser Print rodando na bandeja
   Download: https://www.zebra.com/browserprint
   ============================================= */

let zebraPrinter = null;

// ── Configuração da impressora ────────────────
const ZEBRA_USB_UID = '52n210300332';      // número de série USB da sua ZT230
const ZEBRA_DPI     = 200;                 // resolução da ZT230
const DOTS_PER_MM   = ZEBRA_DPI / 25.4;   // ≈ 8 dots por mm

// ── Tamanho padrão do rolo (ajuste conforme o seu rolo) ──
const ETIQUETA = {
  largura_mm: 60,
  altura_mm:  30,
  copias:     1
};

// ============================================================
// CONEXÃO — prioriza USB, faz fallback para driver/rede
// ============================================================

function conectarImpressora() {

  if (typeof BrowserPrint === 'undefined') {
    console.warn('[Zebra] BrowserPrint não encontrado.');
    _setStatusImpressora('desconectada');
    return;
  }

  // Lista TODOS os dispositivos e escolhe o melhor
  BrowserPrint.getLocalDevices(
    function(dispositivos) {

      if (!dispositivos || !dispositivos.printer || !dispositivos.printer.length) {
        console.warn('[Zebra] Nenhum dispositivo encontrado.');
        _setStatusImpressora('desconectada');
        return;
      }

      const impressoras = dispositivos.printer;

      // 1ª prioridade: USB pelo número de série conhecido
      let escolhida = impressoras.find(p => p.uid === ZEBRA_USB_UID);

      // 2ª prioridade: qualquer USB
      if (!escolhida)
        escolhida = impressoras.find(p => p.connection === 'usb');

      // 3ª prioridade: driver Windows
      if (!escolhida)
        escolhida = impressoras.find(p => p.connection === 'driver');

      // 4ª prioridade: rede local
      if (!escolhida)
        escolhida = impressoras[0];

      zebraPrinter = escolhida;
      console.log(
        `[Zebra] Conectada via ${escolhida.connection}: ${escolhida.name} (${escolhida.uid})`
      );
      _setStatusImpressora('conectada', 'ZT230');
    },
    function(err) {
      console.error('[Zebra] Erro ao listar dispositivos:', err);
      // Fallback: tenta getDefaultDevice
      BrowserPrint.getDefaultDevice('printer',
        function(printer) {
          if (!printer || !printer.uid) {
            _setStatusImpressora('desconectada');
            return;
          }
          zebraPrinter = printer;
          _setStatusImpressora('conectada', 'ZT230');
        },
        function() { _setStatusImpressora('desconectada'); }
      );
    }
  );
}

function _setStatusImpressora(estado, nome) {
  const el = document.getElementById('status-impressora');
  if (!el) return;

  const map = {
    conectada:    { cls: 'db-ok',         txt: `🖨 ${nome || 'Zebra'}` },
    desconectada: { cls: 'db-erro',       txt: '🖨 Impressora offline'  },
    imprimindo:   { cls: 'db-conectando', txt: '🖨 Imprimindo...'       }
  };

  const s = map[estado] || map.desconectada;
  el.className  = 'db-status ' + s.cls;
  el.textContent = s.txt;
}

// ============================================================
// ZPL — gerador de etiqueta (Code128 + nome)
// ============================================================

/**
 * Gera ZPL para etiqueta com barcode Code128 + nome do material.
 * Layout (de cima para baixo):
 *   [    |||||||||||||||    ]   ← barcode
 *   [ 7891234567890        ]   ← número do código
 *   [ Nome do Material     ]   ← nome
 *   [─────────────────────]   ← linha separadora
 *
 * @param {string} codigo
 * @param {string} nome
 * @param {number} copias
 */
function gerarZPL(codigo, nome, copias) {

  const n    = copias || ETIQUETA.copias;
  const larg = Math.round(ETIQUETA.largura_mm * DOTS_PER_MM);
  const alt  = Math.round(ETIQUETA.altura_mm  * DOTS_PER_MM);

  // Margem lateral
  const mx = 20;

  // Altura do barcode: 55% da etiqueta, mínimo 40 dots
  const bcAltura = Math.max(40, Math.round(alt * 0.55));

  // Posições verticais
  const yBC    = 10;                      // topo do barcode
  const yCod   = yBC + bcAltura + 5;     // número do código
  const yNome  = yCod + 22;              // nome do material
  const yLinha = yNome + 24;            // linha separadora

  // Trunca nome se necessário (largura segura ≈ larg/8.5 chars)
  const maxChars = Math.floor((larg - mx * 2) / 8.5);
  const nomeExib = nome.length > maxChars
    ? nome.substring(0, maxChars - 1) + '…'
    : nome;

  return [
    '^XA',
    '^MMT',                              // modo de transferência térmica
    `^PW${larg}`,                        // largura
    `^LL${alt}`,                         // altura (label length)
    '^CI28',                             // charset UTF-8

    // Barcode Code128 — largura automática, sem HRI abaixo
    `^FO${mx},${yBC}`,
    `^BY2`,                              // largura de cada barra (2 dots)
    `^BCN,${bcAltura},N,N,N`,           // Code128, altura, sem texto, sem check, sem início
    `^FD${codigo}^FS`,

    // Número do código
    `^FO${mx},${yCod}`,
    `^A0N,18,18`,
    `^FD${codigo}^FS`,

    // Nome do material
    `^FO${mx},${yNome}`,
    `^A0N,20,20`,
    `^FD${nomeExib}^FS`,

    // Linha separadora
    yLinha < alt - 4
      ? `^FO${mx},${yLinha}^GB${larg - mx * 2},1,1^FS`
      : '',

    `^PQ${n},0,1,Y`,                    // cópias, pausa, corte, ignorar exceções
    '^XZ'
  ].filter(Boolean).join('\n');
}

// ============================================================
// IMPRESSÃO
// ============================================================

function imprimirEtiqueta(cod) {
  // Esta função é chamada pelo botão 🖨 na tabela.
  // O modal de configuração está no app.js (_confirmarImpressao).
  // Se o modal não existir, usa prompt simples como fallback.

  const m = (typeof materiais !== 'undefined') ? materiais[cod] : null;
  if (!m) { alert('Material não encontrado: ' + cod); return; }

  const copias = parseInt(prompt(`Quantas etiquetas para:\n"${m.nome}"?`, '1'));
  if (!copias || copias < 1) return;

  const zpl = gerarZPL(cod, m.nome, copias);
  _enviarParaImpressora(zpl, `${copias}× ${m.nome}`);
}

function imprimirEtiquetaLote(codigos) {
  if (!codigos || !codigos.length) {
    alert('Nenhum código selecionado.');
    return;
  }

  const zplTotal = codigos
    .filter(cod => materiais[cod])
    .map(cod => gerarZPL(cod, materiais[cod].nome, 1))
    .join('\n');

  if (!zplTotal) { alert('Nenhum material válido.'); return; }
  _enviarParaImpressora(zplTotal, `Lote de ${codigos.length} etiquetas`);
}

function _enviarParaImpressora(zpl, descricao) {

  if (typeof BrowserPrint === 'undefined') {
    _alertarInstalacao();
    return;
  }

  const _enviar = () => {
    _setStatusImpressora('imprimindo');

    zebraPrinter.send(zpl,
      function() {
        console.log('[Zebra] ✓ Impresso:', descricao);
        _setStatusImpressora('conectada', 'ZT230');
        if (typeof showAlert === 'function')
          showAlert(`🖨 Etiqueta enviada: <strong>${descricao}</strong>`, 'success');
      },
      function(err) {
        console.error('[Zebra] ✗ Erro:', err);
        _setStatusImpressora('desconectada');
        alert(
          'Erro ao enviar para a impressora.\n\n' +
          'Verifique se:\n' +
          '• O Browser Print está aberto na bandeja\n' +
          '• A ZT230 está ligada e com papel\n' +
          '• O cabo USB está conectado\n\n' +
          'Erro: ' + err
        );
      }
    );
  };

  if (zebraPrinter) {
    _enviar();
    return;
  }

  // Reconecta se perdeu a referência
  console.warn('[Zebra] Reconectando...');
  BrowserPrint.getLocalDevices(
    function(d) {
      const p = (d.printer || []).find(x => x.uid === ZEBRA_USB_UID)
             || (d.printer || [])[0];
      if (!p) { _alertarSemImpressora(); return; }
      zebraPrinter = p;
      _setStatusImpressora('conectada', 'ZT230');
      _enviar();
    },
    function() { _alertarSemImpressora(); }
  );
}

// ============================================================
// UTILITÁRIOS
// ============================================================

function _alertarInstalacao() {
  if (confirm(
    'Zebra Browser Print não encontrado.\n\n' +
    'É necessário instalá-lo para imprimir via USB.\n\n' +
    'Abrir página de download?'
  )) {
    window.open(
      'https://www.zebra.com/us/en/support-downloads/printer-software/browser-print.html',
      '_blank'
    );
  }
}

function _alertarSemImpressora() {
  alert(
    'Impressora ZT230 não encontrada.\n\n' +
    '• Verifique se está ligada e conectada via USB\n' +
    '• Abra o Browser Print (ícone na bandeja)\n' +
    '• Recarregue a página'
  );
}

/**
 * Teste rápido pelo console do navegador.
 * Usage: depurarZPL('codigodoitem')
 */
function depurarZPL(cod) {
  const m = materiais?.[cod];
  if (!m) { console.error('Código não encontrado:', cod); return; }
  const zpl = gerarZPL(cod, m.nome, 1);
  console.log('=== ZPL ===\n' + zpl);
}