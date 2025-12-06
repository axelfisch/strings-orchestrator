import { useState } from 'react';
import { Sparkles, Music } from 'lucide-react';
import CircularSelector from './components/CircularSelector';
import ChordDisplay from './components/ChordDisplay';
import ChordSequencer from './components/ChordSequencer';
import OrchestrationPanel from './components/OrchestrationPanel';

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

function App() {
  const [selectedKey, setSelectedKey] = useState<string>('C');
  const [selectedExtension, setSelectedExtension] = useState<string>('');
  const [selectedBassInversion, setSelectedBassInversion] = useState<string>('');
  const [isForeignBass, setIsForeignBass] = useState<boolean>(false);
  const [selectedStyle, setSelectedStyle] = useState<string>('');
  const [chordSequence, setChordSequence] = useState<ChordInSequence[]>([]);
  const [barConfigs, setBarConfigs] = useState<BarConfig[]>(
    Array.from({ length: 8 }, (_, i) => ({ barNumber: i + 1, chordCount: 1 }))
  );
  const [timeSignature] = useState<string>('4/4');
  const [showOrchestration, setShowOrchestration] = useState<boolean>(true);

  const handleSelectionChange = (key: string, extension: string, bassInversion?: string, isForeign?: boolean) => {
    setSelectedKey(key);
    setSelectedExtension(extension);
    setSelectedBassInversion(bassInversion || '');
    setIsForeignBass(isForeign || false);
  };

  const handleStyleChange = (style: string) => {
    setSelectedStyle(style);
  };

  const handleAddChord = () => {
    if (selectedKey && chordSequence.length < 8) {
      const newChord: ChordInSequence = {
        id: `${Date.now()}-${Math.random()}`,
        key: selectedKey,
        extension: selectedExtension,
        bassInversion: selectedBassInversion,
        isForeignBass: isForeignBass,
        beat: chordSequence.length + 1
      };
      setChordSequence([...chordSequence, newChord]);
    }
  };

  const handleRemoveChord = (id: string) => {
    setChordSequence(chordSequence.filter(chord => chord.id !== id));
  };

  const handleClearSequence = () => {
    setChordSequence([]);
  };

  return (
    <div className="min-h-screen bg-[#050B16] flex flex-col p-4 md:p-8 py-4 md:py-6 overflow-x-hidden">
      {/* Header */}
      <div className="text-center mb-4 md:mb-6 fade-in">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-2">
          <h1 className="text-2xl md:text-4xl font-bold text-[#FFFFFF] tracking-tight ecm-fade">
            🎻 StringsOrchestrator
          </h1>
          <a
            href="https://chatgpt.com/g/g-67f62c947c608191a9c8dc1cd0101e08-aixel-music-orchestrator"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-[#10B981] to-[#059669] hover:from-[#059669] hover:to-[#047857] text-white font-semibold text-xs md:text-sm rounded-full transition-all duration-300 hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl hover:shadow-green-500/30"
            title="Open AiXEL Music Orchestrator GPT"
          >
            <Sparkles className="w-3 h-3 md:w-4 md:h-4" />
            AiXEL GPT
          </a>
        </div>
        <p className="text-[#A9B4C8] text-xs md:text-sm mb-1">
          6-Voice String Orchestra — ECM Style — AiXEL Orchestration
        </p>
        <p className="text-[#566072] text-xs">
          by AxelFisch©2025/2026
        </p>
      </div>

      {/* Main Content */}
      <div className="flex flex-col xl:flex-row gap-4 md:gap-6 mb-4 md:mb-6 max-w-[1920px] mx-auto w-full items-start justify-center px-2">
        {/* Left: Circular Selector */}
        <div className="flex-shrink-0">
          <CircularSelector
            onSelectionChange={handleSelectionChange}
            onStyleChange={handleStyleChange}
          />
        </div>

        {/* Center: Selection Panel */}
        <div className="flex-shrink-0">
          <ChordDisplay
            selectedKey={selectedKey}
            selectedExtension={selectedExtension}
            selectedBassInversion={selectedBassInversion}
            isForeignBass={isForeignBass}
            selectedStyle={selectedStyle}
            onAddChord={handleAddChord}
          />
        </div>

        {/* Right: Orchestration Panel */}
        <div className="flex-shrink-0 w-full xl:w-80">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs text-[#64748B] flex items-center gap-1">
              <Music className="w-3 h-3" />
              String Voicing
            </span>
            <button
              onClick={() => setShowOrchestration(!showOrchestration)}
              className="text-xs text-[#64748B] hover:text-[#F59E0B] transition-colors"
            >
              {showOrchestration ? 'Hide' : 'Show'}
            </button>
          </div>
          {showOrchestration && (
            <OrchestrationPanel
              selectedKey={selectedKey}
              selectedExtension={selectedExtension}
              selectedBassInversion={selectedBassInversion}
              isForeignBass={isForeignBass}
            />
          )}
        </div>
      </div>

      {/* Bottom: Sequence and Transport */}
      <div className="max-w-[1600px] mx-auto w-full px-2">
        <ChordSequencer
          timeSignature={timeSignature}
          sequence={chordSequence}
          selectedStyle={selectedStyle}
          barConfigs={barConfigs}
          onRemoveChord={handleRemoveChord}
          onClearSequence={handleClearSequence}
          onBarConfigChange={setBarConfigs}
        />
      </div>

      {/* Footer */}
      <div className="mt-6 text-center">
        <p className="text-[#475569] text-xs">
          Powered by AiXEL Engine • 6-Voice String Ensemble • ECM-Style Voicings
        </p>
        <p className="text-[#334155] text-xs mt-1">
          Violin 1 & 2 • Viola 1 & 2 • Cello • Contrabass
        </p>
      </div>
    </div>
  );
}

export default App;
