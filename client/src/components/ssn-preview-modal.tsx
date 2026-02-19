import { useState, useEffect, useRef } from 'react';
import { XClose } from '@untitledui/icons';
import { Button } from '@/components/base/buttons/button';
import { ProgressBarBase } from '@/components/base/progress-indicators/progress-indicators';
import { CustomDatePicker } from '@/components/custom-date-picker';

interface SSNPreviewModalProps {
  previewImage: string;
  progress: number;
  stage: string;
  fundingPdfUrl: string | null;
  onSubmit: (data: { id: string; dob: string }) => void;
  onClose: () => void;
}

export const SSNPreviewModal = ({ previewImage, progress, stage, fundingPdfUrl, onSubmit, onClose }: SSNPreviewModalProps) => {
  const [ssn, setSSN] = useState('');
  const [dobValue, setDobValue] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showPdfViewer, setShowPdfViewer] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showDobError, setShowDobError] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const imageContainerRef = useRef<HTMLDivElement>(null);

  // Calculate date range (current date to 300 years back)
  const currentYear = new Date().getFullYear();
  const minYear = currentYear - 300;
  const maxYear = currentYear;

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    const trimmedId = ssn.trim();
    const isIdValid = trimmedId.length >= 4 && trimmedId.length <= 15;
    const isDobValid = dobValue !== null && dobValue.trim() !== '';

    if (!isIdValid) {
      setShowError(true);
      inputRef.current?.focus();
      return;
    }

    if (!isDobValid) {
      setShowDobError(true);
      return;
    }

    setShowError(false);
    setShowDobError(false);
    onSubmit({ id: trimmedId, dob: dobValue! });
    onClose();
  };

  const handleSSNChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 15) {
      setSSN(value);
      if (showError && value.trim().length >= 4) {
        setShowError(false);
      }
    }
  };

  const handleOpenPDF = () => {
    setShowPdfViewer(true);
  };

  const handleClosePdfViewer = () => {
    setShowPdfViewer(false);
  };

  const handleCloseModal = () => {
    // X button closes without validation or storing data
    onClose();
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(5, prev + delta)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    setScale(prev => Math.min(5, prev + 0.2));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(0.5, prev - 0.2));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4">
      <div className="bg-white rounded-lg sm:rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] sm:max-h-[90vh] flex flex-col">
        {/* Header with integrated progress */}
        <div className="border-b-0 relative">
          <div className="flex items-center justify-between px-3 sm:px-4 pt-3 sm:pt-4 pb-2">
            <div className="flex-1 min-w-0">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900">Government ID Required</h2>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 truncate">Enter ID from funding package</p>
            </div>
            <button
              onClick={handleCloseModal}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors ml-2 shrink-0"
            >
              <XClose className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            </button>
          </div>
          <div className="px-3 sm:px-4 pb-1 relative">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {progress === 100 ? (
                  <span className="text-xs font-semibold text-green-600 animate-pulse truncate">✓ Extraction Complete - Waiting for ID</span>
                ) : progress >= 97 ? (
                  <span className="text-xs font-semibold text-yellow-600 animate-pulse truncate">⏳ Almost done — Please enter ID now</span>
                ) : (
                  <>
                    <span className="text-xs font-medium text-gray-600 truncate">{stage}</span>
                    <span className="text-[10px] text-gray-500 whitespace-nowrap hidden sm:inline">• Running in background</span>
                  </>
                )}
              </div>
              <span className="text-xs text-gray-500 shrink-0">{progress}%</span>
            </div>
          </div>
          <ProgressBarBase value={progress} />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
            {/* Preview Image */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs sm:text-sm font-medium text-gray-700">
                  Funding Package - Page 1
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={handleZoomOut}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    -
                  </button>
                  <button
                    onClick={handleResetZoom}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    {Math.round(scale * 100)}%
                  </button>
                  <button
                    onClick={handleZoomIn}
                    className="px-1.5 py-0.5 text-xs font-medium bg-gray-100 hover:bg-gray-200 rounded transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>
              <div
                ref={imageContainerRef}
                className="border border-gray-700 rounded-lg overflow-hidden bg-gray-900 relative h-64 sm:h-80 lg:h-96 p-2"
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <img
                  src={previewImage}
                  alt="Funding package preview"
                  className="w-full h-full object-contain select-none"
                  style={{
                    transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                    transformOrigin: '0 0',
                    transition: isDragging ? 'none' : 'transform 0.1s ease-out',
                  }}
                  draggable={false}
                />
              </div>
            </div>

            {/* ID Input */}
            <div className="space-y-2 sm:space-y-3">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="ssn-input" className="text-xs sm:text-sm font-medium text-gray-700">
                    Government Issued ID
                  </label>
                  <span className="text-[10px] text-gray-500">
                    {ssn.length}/15
                  </span>
                </div>
                <input
                  ref={inputRef}
                  id="ssn-input"
                  type="text"
                  value={ssn}
                  onChange={handleSSNChange}
                  placeholder="SSN, License, Passport..."
                  maxLength={15}
                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 text-sm transition-colors ${
                    showError
                      ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                />
                {showError && (
                  <p className="text-[8px] sm:text-[10px] text-red-600 mt-1">
                    ID must be between 4 and 15 characters
                  </p>
                )}
              </div>

              <CustomDatePicker
                value={dobValue}
                onChange={(date) => {
                  setDobValue(date);
                  if (showDobError && date) {
                    setShowDobError(false);
                  }
                }}
                minYear={minYear}
                maxYear={maxYear}
                label="Date of Birth"
                error={showDobError}
                errorMessage="Date of birth is required"
                variant="light"
              />

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3">
                <p className="text-xs sm:text-sm text-blue-800 mb-1">
                  <strong>Instructions:</strong>
                </p>
                <ul className="text-xs sm:text-sm text-blue-700 space-y-0.5 ml-3 list-disc">
                  <li>Locate the government-issued ID in the preview image above</li>
                  <li>Look for SSN, Driver's License, Passport, or State ID number</li>
                  <li>Zoom and drag the image to view details clearly</li>
                  <li>
                    Image unclear? {fundingPdfUrl && (
                      <button
                        onClick={handleOpenPDF}
                        className="text-blue-600 underline hover:text-blue-800 font-medium"
                      >
                        View full PDF
                      </button>
                    )}
                  </li>
                  <li>Enter the ID exactly as shown (4-15 characters)</li>
                </ul>
              </div>

            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 bg-gray-50 flex items-center justify-end">
          <Button
            size="md"
            color="primary"
            onClick={handleSubmit}
          >
            Submit
          </Button>
        </div>
      </div>
    </div>

    {/* PDF Viewer Modal */}
    {showPdfViewer && fundingPdfUrl && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-2 sm:p-4">
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 border-b border-gray-200">
            <h3 className="text-sm sm:text-base font-semibold text-gray-900">Funding Package PDF</h3>
            <button
              onClick={handleClosePdfViewer}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XClose className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden">
            <iframe
              src={fundingPdfUrl}
              className="w-full h-full border-0"
              title="Funding Package PDF"
            />
          </div>
        </div>
      </div>
    )}
    </>
  );
};
