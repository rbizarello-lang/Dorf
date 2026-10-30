// Painel "Exportar minha sessão": o texto JSON da telemetria local e um botão Copiar.
import { telemetry } from '../telemetry';
import { $ } from './hudBase';

export function bindExport(): { open(): void } {
  const panel = $('exp'), area = $('expTxt') as HTMLTextAreaElement, msg = $('expMsg');
  const close = (): void => { panel.classList.remove('on'); };
  $('expClose').addEventListener('click', close);
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && panel.classList.contains('on')) close(); });
  $('expCopy').addEventListener('click', () => {
    area.focus(); area.select();
    // O clipboard assíncrono só vale dentro do clique; se falhar, o texto já está selecionado para copiar à mão.
    const manual = (): void => {
      let ok = false;
      try { ok = document.execCommand('copy'); } catch { /* ignora */ }
      msg.textContent = ok ? 'Copiado.' : 'Não deu para copiar sozinho: o texto está selecionado, use Ctrl+C (ou toque e segure, Copiar).';
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(area.value).then(() => { msg.textContent = 'Copiado.'; }, manual);
    } else manual();
  });
  return {
    open(): void {
      area.value = telemetry.exportText();
      msg.textContent = 'Fica só neste aparelho. Copie e envie junto das suas anotações.';
      panel.classList.add('on');
      area.scrollTop = 0;
    },
  };
}
