export class Rng {
  private value: number;

  constructor(value: number) {
    this.value = value;
    if (!Number.isFinite(this.value) || this.value === 0) this.value = 1;
  }

  next(): number {
    this.value |= 0;
    this.value = (this.value + 0x6d2b79f5) | 0;
    let t = this.value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  chance(probability: number): boolean {
    return this.next() < probability;
  }

  pick<T>(values: readonly T[]): T {
    return values[Math.floor(this.next() * values.length)] ?? values[0];
  }

  int(max: number): number {
    return Math.floor(this.next() * max);
  }
}
