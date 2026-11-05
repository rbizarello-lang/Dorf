import { LiteWorld } from '../lite';

/** O encaixe puro do Clássico: todos os ganchos no padrão do motor. */
export class BaseWorld extends LiteWorld {
  protected spawn(): LiteWorld {
    return new BaseWorld(this.seed);
  }
}
