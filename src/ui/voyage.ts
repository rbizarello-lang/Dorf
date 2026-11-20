import { CHARTS, FREIGHT_CONTRACTS, HARBORS, type ChartId, type FreightContractId, type Port } from '../core/ports';

export interface Voyage {
  layout: ChartId;
  freight: FreightContractId;
}

export const DEFAULT_VOYAGE: Voyage = { layout: 'confluencia', freight: 'direto' };

export function chartId(v: unknown): ChartId | undefined {
  if (typeof v === 'string' && Object.hasOwn(CHARTS, v)) return v as ChartId;
}

export function freightId(v: unknown): FreightContractId | undefined {
  if (typeof v === 'string' && Object.hasOwn(FREIGHT_CONTRACTS, v)) return v as FreightContractId;
}

const FREIGHT_RULE: Record<FreightContractId, string> = {
  direto: 'A Feira paga 4 peças, a Serraria 6 e o Estaleiro 8 quando o rio os liga à vila.',
  madeira: 'A Feira paga 10 peças se a Serraria abrir antes ou na mesma jogada. Se a Feira abrir primeiro, espera a Serraria e paga 4. A Serraria paga 6 e o Estaleiro, 8.',
};

export function freightDialog(voyage: Voyage, editing: boolean, warning = '') {
  const options = (Object.keys(CHARTS) as ChartId[]).map((id) =>
    `<option value="${id}"${id === voyage.layout ? ' selected' : ''}>${CHARTS[id]}</option>`).join('');
  const cards = (Object.keys(FREIGHT_CONTRACTS) as FreightContractId[]).map((id) =>
    `<button class="mode-card" type="button" data-act="freight" data-edit="${editing}" data-freight="${id}"${editing ? ` aria-current="${id === voyage.freight}"` : ''}>
      <strong>${FREIGHT_CONTRACTS[id]}</strong><span>${FREIGHT_RULE[id]}</span></button>`).join('');
  return `<h2 id="modal-title">Entrepostos</h2>
    <p>Ligue a vila aos três cais por um rio contínuo. Gire a peça para prolongar uma saída de rio da vila. Cada entrega devolve peças à pilha.</p>
    <label class="voyage-layout">Carta fluvial <select id="voyage-layout">${options}</select></label>
    <div class="modes">${cards}</div>
    ${warning}
    <div class="row"><button class="secondary" type="button" data-act="${editing ? 'close' : 'modes'}">${editing ? 'Voltar à carta' : 'Voltar aos modos'}</button></div>`;
}

export function voyageHelp(voyage: Voyage, leftoverPoints: number) {
  return `<p>Monte um rio contínuo da vila aos três cais marcados. Cada cais é uma casa reservada: coloque ali uma peça com rio.
    Quando a água chega à vila por bordas de rio encaixadas, a ligação conta, inclusive se você montou um trecho separado antes.</p>
    <p><b>${FREIGHT_CONTRACTS[voyage.freight]}</b>. ${FREIGHT_RULE[voyage.freight]}</p>
    <p>O botão Carta fluvial mostra o progresso. Toque no nome de um cais para localizá-lo ou enquadre a carta toda.</p>
    <p>A viagem termina com os três fretes pagos ou a pilha vazia. Com os três pagos, cada peça restante vale ${leftoverPoints} pontos.
    Você pode mudar o frete e a carta até a primeira jogada e desfazer com <kbd>U</kbd>.</p>`;
}

function portStatus(port: Port, occupied: boolean) {
  if (port.delivered) return `Entregue · +${port.reward ?? HARBORS[port.id].tiles}`;
  if (port.connectedAt !== undefined) return 'Em espera';
  return occupied ? 'Sem ligação' : 'A ligar';
}

export class VoyagePanel {
  private readonly root = document.getElementById('voyage')!;
  private readonly toggle = this.root.querySelector<HTMLButtonElement>('#voyage-toggle')!;
  private readonly body = this.root.querySelector<HTMLElement>('#voyage-body')!;
  private readonly progress = this.root.querySelector<HTMLElement>('#voyage-progress')!;
  private readonly order = this.root.querySelector<HTMLElement>('#voyage-order')!;
  private readonly change = this.root.querySelector<HTMLButtonElement>('#voyage-change')!;
  private readonly compact = matchMedia('(max-width: 650px), (max-height: 560px)');
  private readonly rows: HTMLButtonElement[];

  constructor(onFocus: (id: number) => void, onFit: () => void, onChange: () => void) {
    const list = this.root.querySelector('#voyage-ports')!;
    this.rows = HARBORS.map((h, id) => {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.setProperty('--harbor-color', h.color);
      btn.innerHTML = `<span class="voyage-number" aria-hidden="true">${id + 1}</span><strong>${h.name}</strong><span class="voyage-state"></span>`;
      btn.addEventListener('click', () => {
        if (this.compact.matches) {
          this.setOpen(false);
          this.toggle.focus({ preventScroll: true });
        }
        onFocus(id);
      });
      li.append(btn);
      list.append(li);
      return btn;
    });
    this.toggle.addEventListener('click', () => this.setOpen(this.body.hidden === true));
    this.root.querySelector('#voyage-fit')!.addEventListener('click', () => {
      if (this.compact.matches) {
        this.setOpen(false);
        this.toggle.focus({ preventScroll: true });
      }
      onFit();
    });
    this.change.addEventListener('click', onChange);
    this.compact.addEventListener('change', () => this.setOpen(!this.compact.matches));
  }

  private setOpen(open: boolean) {
    this.body.hidden = !open;
    this.toggle.setAttribute('aria-expanded', String(open));
  }

  render(ports: readonly Port[], voyage: Voyage, canChange: boolean, occupied: (port: Port) => boolean) {
    const entering = this.root.hidden;
    this.root.hidden = !ports.length;
    if (!ports.length) return;
    if (entering) this.setOpen(!this.compact.matches);
    const paid = ports.filter((p) => p.delivered).length;
    const progress = `${paid}/${ports.length} entregas`;
    if (this.progress.textContent !== progress) this.progress.textContent = progress;
    this.toggle.title = CHARTS[voyage.layout];
    const [fair, sawmill] = ports;
    const objective = paid === ports.length ? 'Os três fretes foram pagos.'
      : voyage.freight === 'madeira' && !fair.delivered
        ? sawmill.delivered ? 'Leve o rio até a Feira para entregar a madeira.'
          : fair.connectedAt !== undefined ? 'A Feira espera a madeira. Ligue a Serraria.'
            : 'Ligue a Serraria antes da Feira para ganhar 10 peças na Feira.'
        : 'Ligue os cais à vila por um rio contínuo.';
    this.order.textContent = `${CHARTS[voyage.layout]} · ${FREIGHT_CONTRACTS[voyage.freight]}: ${objective}`;
    this.change.hidden = !canChange;
    for (const p of ports) {
      const row = this.rows[p.id];
      const status = portStatus(p, occupied(p));
      const state = row.querySelector('.voyage-state')!;
      const info = HARBORS[p.id];
      const cargo = p.id === 0 && voyage.freight === 'madeira' ? 'Madeira da Serraria' : info.cargo;
      row.classList.toggle('delivered', p.delivered);
      row.classList.toggle('waiting', p.connectedAt !== undefined && !p.delivered);
      state.textContent = status;
      row.title = `Localizar ${info.name} · ${cargo}`;
      row.setAttribute('aria-label', `Localizar ${info.name}. ${cargo}. ${status}${p.delivered ? ' peças' : ''}.`);
    }
  }
}
