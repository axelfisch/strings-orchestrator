import { Studio } from "./features/circular/Studio";

export interface ChordInSequence {
  id: string;
  key: string;
  extension: string;
  bassInversion?: string;
  isForeignBass?: boolean;
  beat: number;
  position?: 1 | 2;
}

export interface BarConfig {
  barNumber: number;
  chordCount: 1 | 2;
}

export default function App() {
  return <Studio />;
}
