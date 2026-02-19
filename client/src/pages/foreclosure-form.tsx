import { useState, useCallback, useEffect, useRef } from "react";
import { ArrowLeft, Download01, File06, CheckCircle, AlertCircle, Zap, Upload01, FileCheck02, Printer } from "@untitledui/icons";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { Button } from "@/components/base/buttons/button";
import { Badge } from "@/components/base/badges/badges";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { SSNPreviewModal } from "@/components/ssn-preview-modal";
import { CustomDatePicker } from '@/components/custom-date-picker';
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { PDFViewer, BlobProvider } from '@react-pdf/renderer';
import FinalResult from '@/pages/React-PDF/FinalResult';
import { downloadDocx } from '@/pages/React-PDF/FinalResultDocx';

interface ExtractedFields {
    [key: string]: any;
}


interface ValidationData {
    confidence: number;
    warnings: string[];
    errors: string[];
    checks_passed: number;
    checks_failed: number;
    filled_fields: number;
    total_fields: number;
    completion_ratio: number;
    missing_fields: string[];
}

const FIELD_LABELS: Record<string, string> = {
    grantor_name: "Grantor Name",
    grantor_rep: "Grantor Representative",
    grantor_rep_title: "Rep Title",
    common_address: "Common Address",
    county: "County",
    ein: "EIN",
    ssn: "Government ID (SSN / Driver's License)",
    dob: "Date of Birth",
    dl_number: "Driver's License #",
    note_date: "Note Date",
    note_amount: "Note Amount",
    note_maturity_date: "Note Maturity Date",
    interest_rate: "Interest Rate",
    dot_effective_date: "DOT Date Signed",
    dot_recording_date: "DOT Date Recorded",
    dot_instrument_number: "DOT Instrument #",
    trustee: "Trustee",
    original_grantee: "Original Grantee/Lender",
    current_grantee: "Current Grantee/Lender",
    loan_servicer: "Loan Servicer",
    legal_description_recording: "Legal Description (Recording)",
    legal_description_metes_bounds: "Legal Description (Metes & Bounds)",
    servicelink_trustees: "ServiceLink Trustees",
    county_seat: "County Seat",
    sale_hours: "Sale Hours",
    sale_location: "Sale Location",
    servicelink_date: "ServiceLink Date",
};

const FIELD_SECTIONS: { title: string; fields: string[] }[] = [
    {
        title: "Property & Location",
        fields: ["common_address", "county", "county_seat"],
    },
    {
        title: "Grantor / Borrower",
        fields: ["grantor_name", "grantor_rep", "grantor_rep_title"],
    },
    {
        title: "Identification",
        fields: ["ein", "dob", "ssn"],
    },
    {
        title: "Parties",
        fields: ["original_grantee", "current_grantee", "trustee", "loan_servicer"],
    },
    {
        title: "Deed of Trust",
        fields: ["dot_instrument_number", "dot_effective_date", "dot_recording_date"],
    },
    {
        title: "Promissory Note",
        fields: ["note_date", "note_amount", "note_maturity_date", "interest_rate"],
    },
    {
        title: "Legal Description",
        fields: ["legal_description_recording", "legal_description_metes_bounds"],
    },
    {
        title: "ServiceLink / Sale Info",
        fields: ["servicelink_trustees", "servicelink_date", "sale_hours", "sale_location"],
    },
];

const DOCUMENT_TYPES = [
    {
        id: "funding",
        label: "Funding Package",
        description: "Main bundle from the lender",
        required: true,
    },
    {
        id: "dot",
        label: "Recorded Deed of Trust",
        description: "Recorded copy with instrument #",
        required: true,
    },
    {
        id: "servicelink",
        label: "ServiceLink Trustee List",
        description: "County-specific substitute trustees",
        required: false,
    },
];

const PIPELINE_STAGES = [
    "Uploading",
    "Splitting",
    "Extracting",
    "Validating",
    "Repairing",
    "Waiting for ID input",
    "Complete",
];

export const ForeclosureForm = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [processingStage, setProcessingStage] = useState("Uploading");
    const [processingProgress, setProcessingProgress] = useState(0);
    const [elapsedSeconds, setElapsedSeconds] = useState(0);
    const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null);
    const [validationData, setValidationData] = useState<ValidationData | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);
    const [reviewConfirmed, setReviewConfirmed] = useState(false);
    const [_activeJobId, setActiveJobId] = useState<string | null>(null);
    const [showSSNModal, setShowSSNModal] = useState(false);
    const [fundingPreviewImage, setFundingPreviewImage] = useState<string | null>(null);
    const [fundingPdfUrl, setFundingPdfUrl] = useState<string | null>(null);
    const [extractionComplete, setExtractionComplete] = useState(false);
    const [canGenerate, setCanGenerate] = useState(false);
    const [revalidating, setRevalidating] = useState(false);
    const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const startTimeRef = useRef<number>(0);
    const serverProgressRef = useRef<number>(0);
    const ssnSubmittedRef = useRef<boolean>(false);
    const ssnDismissedRef = useRef<boolean>(false);

    // Fetch job result and transition to step 2
    const fetchJobResult = useCallback(async (jobId: string) => {
        try {
            const res = await fetch(`/api/foreclosure/job-result/${jobId}`);
            if (!res.ok) throw new Error("Failed to fetch job result");
            const data = await res.json();
            if (data.success && data.fields) {
                setProcessingProgress(100);
                setProcessingStage("Complete");
                await new Promise(resolve => setTimeout(resolve, 400));
                setExtractedFields(data.fields);
                if (data.validation) setValidationData(data.validation);
                setCanGenerate(data.can_generate ?? false);
                setCurrentStep(3);
            } else {
                throw new Error("No fields returned");
            }
        } catch (err: any) {
            setError(err.message || "Failed to fetch results");
        } finally {
            localStorage.removeItem("activeJobId");
            localStorage.removeItem("activeJobStart");
            setActiveJobId(null);
            setProcessing(false);
        }
    }, []);

    // Start polling a job
    const startPolling = useCallback((jobId: string) => {
        // Clear any existing polling
        if (pollingRef.current) clearInterval(pollingRef.current);

        setProcessing(true);
        setError(null);
        setActiveJobId(jobId);

        pollingRef.current = setInterval(async () => {
            try {
                const res = await fetch(`/api/foreclosure/job-status/${jobId}`);
                if (!res.ok) {
                    // Job not found — expired or invalid
                    if (res.status === 404) {
                        clearInterval(pollingRef.current!);
                        pollingRef.current = null;
                        localStorage.removeItem("activeJobId");
                        localStorage.removeItem("activeJobStart");
                        setActiveJobId(null);
                        setProcessing(false);
                        setError("Job expired or not found. Please re-upload and try again.");
                        return;
                    }
                    return;
                }
                const status = await res.json();

                serverProgressRef.current = status.progress;
                setProcessingStage(status.stage);

                // Show SSN modal if preview image is available and modal not shown yet
                // NEVER reopen if already submitted (using REF to avoid closure issue)
                if (status.fundingPreviewImage && !showSSNModal && !fundingPreviewImage && !ssnSubmittedRef.current) {
                    setFundingPreviewImage(status.fundingPreviewImage);
                    const jobId = localStorage.getItem("activeJobId");
                    if (jobId) {
                        setFundingPdfUrl(`/api/foreclosure/funding-pdf/${jobId}`);
                    }
                    setShowSSNModal(true);
                } else if (status.fundingPreviewImage && ssnSubmittedRef.current) {
                }

                if (status.status === "completed") {
                    setExtractionComplete(true);
                    if (ssnSubmittedRef.current) {
                        // SSN submitted — proceed to results
                        clearInterval(pollingRef.current!);
                        pollingRef.current = null;
                        await fetchJobResult(jobId);
                    } else if (ssnDismissedRef.current && fundingPreviewImage) {
                        // User dismissed modal earlier — reopen it now that extraction is done
                        ssnDismissedRef.current = false;
                        setShowSSNModal(true);
                    }
                } else if (status.status === "failed" || status.status === "cancelled") {
                    clearInterval(pollingRef.current!);
                    pollingRef.current = null;
                    localStorage.removeItem("activeJobId");
                    localStorage.removeItem("activeJobStart");
                    setActiveJobId(null);
                    setProcessing(false);
                    setError(status.error || "Processing failed on server");
                }
            } catch {
                // Network error — keep polling, don't crash
            }
        }, 2000);
    }, [fetchJobResult]);

    // Smooth progress animation + elapsed timer — runs while processing
    useEffect(() => {
        if (!processing) {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
            return;
        }

        if (!startTimeRef.current) {
            startTimeRef.current = Date.now();
        }

        timerRef.current = setInterval(() => {
            setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));

            // Smoothly animate toward server-reported progress
            // Speed scales with gap size so large jumps catch up quickly
            setProcessingProgress(prev => {
                const target = serverProgressRef.current;
                if (target >= 100) return 100;
                const gap = target - prev;
                if (gap <= 0) return prev;
                // Small gap: +1%, medium gap: +2-3%, large gap: +5-10%
                const step = Math.max(1, Math.ceil(gap * 0.15));
                return Math.min(prev + step, target);
            });
        }, 200);

        return () => {
            if (timerRef.current) {
                clearInterval(timerRef.current);
                timerRef.current = null;
            }
        };
    }, [processing]);

    // Resume on page load if there's an active job
    useEffect(() => {
        const savedJobId = localStorage.getItem("activeJobId");
        const savedStart = localStorage.getItem("activeJobStart");
        if (savedJobId) {
            if (savedStart) {
                startTimeRef.current = parseInt(savedStart, 10);
            } else {
                startTimeRef.current = Date.now();
            }
            startPolling(savedJobId);
        }
    }, [startPolling]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (pollingRef.current) clearInterval(pollingRef.current);
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    const handleDropFiles = useCallback((fileList: FileList) => {
        const files = Array.from(fileList).filter(f => f.type === "application/pdf");
        setSelectedFiles(prev => [...prev, ...files]);
        setError(null);
    }, []);

    const handleDeleteFile = useCallback((index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    }, []);

    const handleProcess = async () => {
        if (selectedFiles.length === 0) return;

        setProcessing(true);
        setError(null);
        setProcessingStage("Uploading");
        setProcessingProgress(0);
        setElapsedSeconds(0);
        startTimeRef.current = Date.now();

        try {
            const formData = new FormData();
            selectedFiles.forEach(file => formData.append("files", file));

            const response = await fetch("/api/foreclosure/process", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Processing failed");
            }

            const data = await response.json();

            if (data.jobId) {
                // Persist job for resume-on-refresh
                localStorage.setItem("activeJobId", data.jobId);
                localStorage.setItem("activeJobStart", String(startTimeRef.current));
                startPolling(data.jobId);
            } else {
                throw new Error("No job ID returned from server");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred during processing");
            setProcessing(false);
        }
    };

    const handleCancelJob = async () => {
        const jobId = localStorage.getItem("activeJobId");
        if (!jobId) return;

        try {
            await fetch(`/api/foreclosure/job-cancel/${jobId}`, { method: "POST" });
        } catch {
            // Even if the cancel request fails, clean up locally
        }

        // Stop polling and timer
        if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
        }
        localStorage.removeItem("activeJobId");
        localStorage.removeItem("activeJobStart");
        setActiveJobId(null);
        setProcessing(false);
        setProcessingProgress(0);
        setProcessingStage("Uploading");
        setElapsedSeconds(0);
        startTimeRef.current = 0;
    };

    const handleSSNSubmit = async (data: { id: string; dob: string }) => {
        const jobId = localStorage.getItem("activeJobId");
        if (!jobId) return;

        // Set REF FIRST - this updates immediately, not async like setState
        ssnSubmittedRef.current = true;
        
        // Close modal immediately
        setShowSSNModal(false);
        
        try {
            await fetch(`/api/foreclosure/submit-ssn/${jobId}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ssn: data.id, dob: data.dob }),
            });
            // If extraction is complete, proceed to results
            if (extractionComplete) {
                if (pollingRef.current) {
                    clearInterval(pollingRef.current);
                    pollingRef.current = null;
                }
                await fetchJobResult(jobId);
            }
        } catch (err) {
            console.error("Failed to submit ID and DOB:", err);
        }
    };

    const handleCloseSSNModal = () => {
        if (!ssnSubmittedRef.current) {
            // Closed via X without submitting — mark as dismissed, don't store data
            ssnDismissedRef.current = true;
        }
        setShowSSNModal(false);
    };

    const handleFieldChange = (key: string, value: string) => {
        if (!extractedFields) return;
        if (key === "servicelink_trustees") {
            setExtractedFields({ ...extractedFields, [key]: value.split(",").map(s => s.trim()).filter(Boolean) });
        } else {
            setExtractedFields({ ...extractedFields, [key]: value });
        }
    };

    const handleDateChange = (key: string, dateValue: string) => {
        if (!extractedFields) return;
        setExtractedFields({ ...extractedFields, [key]: dateValue });
    };

    const isDateField = (key: string) => {
        return key === 'note_date' || key === 'note_maturity_date' || 
               key === 'dot_effective_date' || key === 'dot_recording_date' || 
               key === 'servicelink_date' || key === 'dob';
    };


    const handleGenerateDocx = async () => {
        if (!extractedFields) return;

        setGenerating(true);
        setError(null);

        try {
            await downloadDocx(extractedFields);
        } catch (err: any) {
            setError(err.message || "Failed to generate document");
        } finally {
            setGenerating(false);
        }
    };


    const handleBack = () => {
        if (currentStep === 3) setCurrentStep(1);
        else if (currentStep === 4) setCurrentStep(3);
    };

    const navItems: any[] = [];
    const filledCount = extractedFields
        ? Object.entries(extractedFields).filter(([_, v]) => {
            if (v === null || v === undefined) return false;
            if (Array.isArray(v)) return v.length > 0;
            return String(v).trim() !== "";
        }).length
        : 0;
    const totalFields = extractedFields ? Object.keys(extractedFields).length : 0;

    const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

    const steps = [
        { num: 1, display: 1, label: "Upload Documents" },
        { num: 3, display: 2, label: "Review & Edit" },
        { num: 4, display: 3, label: "Generate" },
    ];

    return (
        <div className="min-h-screen bg-secondary">
            <HeaderNavigationBase
                activeUrl="/foreclosure-form"
                items={navItems}
                showAvatarDropdown={true}
                hideBorder={false}
                showSettingsButton={false}
                showNotificationsButton={false}
            />

            <main className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
                {/* Progress Steps */}
                <nav className="mb-10">
                    <ol className="flex items-center">
                        {steps.map(({ num, display, label }, idx) => {
                            const isActive = num === currentStep;
                            const isComplete = num < currentStep;
                            return (
                                <li key={num} className={`flex items-center ${idx < steps.length - 1 ? "flex-1" : ""}`}>
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                                                isComplete
                                                    ? "bg-brand-solid text-fg-white"
                                                    : isActive
                                                      ? "bg-brand-solid text-fg-white ring-4 ring-brand-secondary"
                                                      : "bg-tertiary text-fg-quaternary"
                                            }`}
                                        >
                                            {isComplete ? (
                                                <CheckCircle className="size-4" />
                                            ) : (
                                                display
                                            )}
                                        </div>
                                        <span
                                            className={`hidden text-sm font-medium sm:block ${
                                                isActive ? "text-brand-secondary" : isComplete ? "text-secondary" : "text-quaternary"
                                            }`}
                                        >
                                            {label}
                                        </span>
                                    </div>
                                    {idx < steps.length - 1 && (
                                        <div className="mx-3 h-px flex-1 bg-border-secondary">
                                            <div
                                                className={`h-full transition-all duration-500 ${
                                                    isComplete ? "bg-brand-solid" : "bg-transparent"
                                                }`}
                                            />
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ol>
                </nav>

                {error && (
                    <div className="mb-6 flex items-start gap-3 rounded-xl border border-error-secondary bg-error-primary p-4">
                        <AlertCircle className="mt-0.5 size-5 shrink-0 text-fg-error-primary" />
                        <div>
                            <p className="text-sm font-semibold text-error-primary">Something went wrong</p>
                            <p className="mt-1 text-sm text-error-primary">{error}</p>
                        </div>
                    </div>
                )}

                {/* Step 1: Upload */}
                {currentStep === 1 && !processing && (
                    <div>
                        {/* Header */}
                        <div className="mb-8">
                            <div className="flex items-center gap-3 mb-3">
                                <FeaturedIcon color="brand" theme="modern" size="md">
                                    <Upload01 className="size-5" />
                                </FeaturedIcon>
                                <div>
                                    <h1 className="text-display-xs font-semibold text-primary">
                                        New File Abstract
                                    </h1>
                                    <p className="text-sm text-tertiary">
                                        Upload your documents and AI will extract all fields automatically.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Expected Documents */}
                        <div className="mb-6">
                            <h3 className="mb-3 text-sm font-medium text-secondary">Expected documents</h3>
                            <div className="grid gap-3 sm:grid-cols-3">
                                {DOCUMENT_TYPES.map((doc) => {
                                    const hasMatch = selectedFiles.some(f => {
                                        const name = f.name.toLowerCase();
                                        if (doc.id === "funding") return name.includes("fund") || name.includes("pkg");
                                        if (doc.id === "dot") return name.includes("dot") || name.includes("deed") || name.includes("trust");
                                        if (doc.id === "servicelink") return name.includes("service") || name.includes("trustee") || name.includes("asap");
                                        return false;
                                    });
                                    return (
                                        <div
                                            key={doc.id}
                                            className={`relative flex flex-col gap-2 rounded-xl p-4 ring-1 ring-inset transition-all duration-200 ${
                                                hasMatch
                                                    ? "bg-success-primary ring-success-secondary"
                                                    : "bg-primary ring-secondary"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <File06 className={`size-5 ${hasMatch ? "text-fg-success-primary" : "text-fg-quaternary"}`} />
                                                {doc.required ? (
                                                    <Badge type="color" size="sm" color={hasMatch ? "success" : "gray"}>
                                                        Required
                                                    </Badge>
                                                ) : (
                                                    <Badge type="color" size="sm" color={hasMatch ? "success" : "gray"}>
                                                        Optional
                                                    </Badge>
                                                )}
                                            </div>
                                            <div>
                                                <p className={`text-sm font-medium ${hasMatch ? "text-success-primary" : "text-secondary"}`}>
                                                    {doc.label}
                                                </p>
                                                <p className={`text-xs ${hasMatch ? "text-success-secondary" : "text-tertiary"}`}>
                                                    {hasMatch ? "Detected" : doc.description}
                                                </p>
                                            </div>
                                            {hasMatch && (
                                                <div className="absolute -top-1.5 -right-1.5">
                                                    <CheckCircle className="size-5 rounded-full bg-primary text-fg-success-primary" />
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Drop Zone */}
                        <div className="mb-4">
                            <FileUpload.Root>
                                <FileUpload.DropZone
                                    onDropFiles={handleDropFiles}
                                    hint="PDF files only (max. 50MB per file)"
                                    accept=".pdf"
                                    maxSize={50 * 1024 * 1024}
                                />
                            </FileUpload.Root>
                        </div>

                        {/* File List */}
                        {selectedFiles.length > 0 && (
                            <div className="mb-2">
                                <FileUpload.Root>
                                    <FileUpload.List>
                                        {selectedFiles.map((file, index) => (
                                            <FileUpload.ListItemProgressFill
                                                key={`${file.name}-${index}`}
                                                name={file.name}
                                                size={file.size}
                                                progress={100}
                                                type="pdf"
                                                onDelete={() => handleDeleteFile(index)}
                                            />
                                        ))}
                                    </FileUpload.List>
                                </FileUpload.Root>

                                <div className="mt-3 flex items-center justify-between px-1">
                                    <p className="text-xs text-tertiary">
                                        {selectedFiles.length} {selectedFiles.length === 1 ? "file" : "files"} selected
                                        <span className="mx-1.5 text-quaternary">&middot;</span>
                                        {(totalFileSize / 1024 / 1024).toFixed(1)} MB total
                                    </p>
                                    <button
                                        onClick={() => setSelectedFiles([])}
                                        className="text-xs font-medium text-tertiary transition-colors hover:text-error-primary"
                                    >
                                        Clear all
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-8 flex items-center justify-between border-t border-secondary pt-6">
                            <Button
                                size="md"
                                color="secondary"
                                onClick={() => (window.location.href = "/dashboard")}
                                iconLeading={ArrowLeft}
                            >
                                Dashboard
                            </Button>
                            <Button
                                size="lg"
                                onClick={handleProcess}
                                disabled={selectedFiles.length === 0}
                                iconTrailing={Zap}
                            >
                                Extract Fields
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 1: Processing State */}
                {currentStep === 1 && processing && (
                    <div className="flex flex-col items-center py-12">
                        <div className="relative mb-8">
                            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-secondary">
                                <Zap className="size-7 text-fg-brand-primary animate-pulse" />
                            </div>
                        </div>

                        <h2 className="mb-2 text-lg font-semibold text-primary">
                            Processing your documents
                        </h2>
                        <p className="mb-8 max-w-md text-center text-sm text-tertiary">
                            AI is reading through {selectedFiles.length} {selectedFiles.length === 1 ? "document" : "documents"} and extracting all fields for your File Abstract. This usually takes 30-60 seconds.
                        </p>

                        {/* Progress bar */}
                        <div className="w-full max-w-md mb-8">
                            <ProgressBarBase
                                value={processingProgress}
                                min={0}
                                max={100}
                            />
                            <p className="mt-2 text-center text-xs text-quaternary tabular-nums">
                                {Math.round(processingProgress)}%
                                <span className="mx-1.5 text-quaternary">&middot;</span>
                                {elapsedSeconds >= 60
                                    ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
                                    : `${elapsedSeconds}s`
                                }
                            </p>
                        </div>

                        {/* Processing steps */}
                        <div className="w-full max-w-sm space-y-3">
                            {PIPELINE_STAGES.map((stage) => {
                                const stageIdx = PIPELINE_STAGES.indexOf(stage);
                                const currentIdx = PIPELINE_STAGES.indexOf(processingStage);
                                const isActive = stage === processingStage && processingStage !== "Complete";
                                const isDone = currentIdx > stageIdx || processingStage === "Complete";
                                return (
                                    <div
                                        key={stage}
                                        className={`flex items-center gap-3 rounded-lg px-4 py-2.5 transition-all duration-300 ${
                                            isActive
                                                ? "bg-brand-secondary"
                                                : isDone
                                                  ? "bg-success-primary"
                                                  : "bg-primary"
                                        }`}
                                    >
                                        {isDone ? (
                                            <CheckCircle className="size-4 shrink-0 text-fg-success-primary" />
                                        ) : isActive ? (
                                            <div className="size-4 shrink-0 animate-spin rounded-full border-2 border-brand-solid border-t-transparent" />
                                        ) : (
                                            <div className="size-4 shrink-0 rounded-full border-2 border-disabled" />
                                        )}
                                        <span
                                            className={`text-sm ${
                                                isActive
                                                    ? "font-medium text-brand-secondary"
                                                    : isDone
                                                      ? "text-success-primary"
                                                      : "text-quaternary"
                                            }`}
                                        >
                                            {stage}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="mt-8 flex flex-col items-center gap-3">
                            <button
                                onClick={handleCancelJob}
                                className="rounded-lg px-4 py-2 text-sm font-medium text-error-primary ring-1 ring-inset ring-error-secondary transition-colors hover:bg-error-primary"
                            >
                                Stop Processing
                            </button>
                        </div>
                    </div>
                )}


                {/* Step 3: Review & Edit Fields */}
                {currentStep === 3 && extractedFields && (
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            <FeaturedIcon color="brand" theme="modern" size="md">
                                <File06 className="size-5" />
                            </FeaturedIcon>
                            <div>
                                <h1 className="text-display-xs font-semibold text-primary">
                                    Review & Edit Fields
                                </h1>
                                <p className="text-sm text-tertiary">
                                    {filledCount} of {totalFields} fields extracted. Edit values before generating the File Abstract.
                                </p>
                            </div>
                        </div>

                        {/* Validation Status — moved from Step 2 */}
                        {validationData && (
                            <div className={`mb-6 overflow-hidden rounded-xl ring-1 ring-inset ${
                                validationData.confidence >= 0.85
                                    ? "bg-success-primary ring-success-secondary"
                                    : validationData.confidence >= 0.65
                                    ? "bg-warning-primary ring-warning-secondary"
                                    : "bg-error-primary ring-error-secondary"
                            }`}>
                                <div className={`flex items-center justify-between border-b px-4 py-3 ${
                                    validationData.confidence >= 0.85
                                        ? "border-success-secondary"
                                        : validationData.confidence >= 0.65
                                        ? "border-warning-secondary"
                                        : "border-error-secondary"
                                }`}>
                                    <h3 className="text-sm font-semibold text-secondary">Validation Status</h3>
                                    <div className="flex items-center gap-2">
                                        <span className={`text-lg font-bold ${
                                            validationData.confidence >= 0.85
                                                ? "text-success-primary"
                                                : validationData.confidence >= 0.65
                                                ? "text-warning-primary"
                                                : "text-error-primary"
                                        }`}>
                                            {Math.round(validationData.confidence * 100)}%
                                        </span>
                                        <Badge type="color" size="sm" color={validationData.confidence >= 0.85 ? "success" : validationData.confidence >= 0.65 ? "warning" : "error"}>
                                            {validationData.checks_passed} passed
                                        </Badge>
                                        {validationData.checks_failed > 0 && (
                                            <Badge type="color" size="sm" color="error">
                                                {validationData.checks_failed} failed
                                            </Badge>
                                        )}
                                    </div>
                                </div>
                                <div className="p-4 space-y-3">
                                    <div className="flex items-center gap-3 text-xs text-secondary">
                                        <span className="font-medium">{validationData.filled_fields}/{validationData.total_fields} fields filled</span>
                                        <div className="h-1.5 flex-1 rounded-full bg-secondary">
                                            <div
                                                className={`h-full rounded-full transition-all ${
                                                    validationData.completion_ratio >= 0.9
                                                        ? "bg-(--color-success-500)"
                                                        : validationData.completion_ratio >= 0.75
                                                        ? "bg-(--color-warning-500)"
                                                        : "bg-(--color-error-500)"
                                                }`}
                                                style={{ width: `${Math.round(validationData.completion_ratio * 100)}%` }}
                                            />
                                        </div>
                                        <span className="tabular-nums">{Math.round(validationData.completion_ratio * 100)}%</span>
                                    </div>
                                    {validationData.missing_fields.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                            {validationData.missing_fields.map((field) => (
                                                <span key={field} className="inline-block rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-quaternary">
                                                    {field}
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                    {validationData.errors.length > 0 && (
                                        <div>
                                            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-error-primary">
                                                Errors — must fix before generating
                                            </h4>
                                            <ul className="space-y-1">
                                                {validationData.errors.map((err, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-error-primary">
                                                        <AlertCircle className="mt-0.5 size-3 shrink-0" />
                                                        {err}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {validationData.warnings.length > 0 && (
                                        <div>
                                            <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-warning-primary">
                                                Warnings — review recommended
                                            </h4>
                                            <ul className="space-y-1">
                                                {validationData.warnings.map((warn, i) => (
                                                    <li key={i} className="flex items-start gap-2 text-xs text-warning-primary">
                                                        <AlertCircle className="mt-0.5 size-3 shrink-0" />
                                                        {warn}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                    {validationData.errors.length === 0 && validationData.warnings.length === 0 && (
                                        <p className="flex items-center gap-2 text-xs text-success-primary">
                                            <CheckCircle className="size-3" />
                                            All validation checks passed
                                        </p>
                                    )}
                                </div>
                            </div>
                        )}

                        <div className="space-y-5">
                            {FIELD_SECTIONS.map((section) => {
                                const sectionHasData = section.fields.some((f) => {
                                    const val = extractedFields[f];
                                    if (val === null || val === undefined) return false;
                                    if (Array.isArray(val)) return val.length > 0;
                                    return String(val).trim() !== "";
                                });
                                return (
                                    <div
                                        key={section.title}
                                        className="overflow-hidden rounded-xl bg-primary ring-1 ring-inset ring-secondary"
                                    >
                                        <div className={`flex items-center gap-2 border-b px-4 py-3 ${sectionHasData ? "border-success-secondary bg-success-primary" : "border-secondary bg-secondary"}`}>
                                            <h3 className="text-sm font-semibold text-secondary">
                                                {section.title}
                                            </h3>
                                            {sectionHasData && (
                                                <Badge type="color" size="sm" color="success">
                                                    Data found
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="p-4 space-y-3">
                                            {section.fields.map((fieldKey) => {
                                                const rawValue = extractedFields[fieldKey];
                                                const displayValue = Array.isArray(rawValue) ? rawValue.join(", ") : (rawValue || "");
                                                return (
                                                    <div key={fieldKey}>
                                                        <label className="mb-1.5 block text-xs font-medium text-tertiary">
                                                            {FIELD_LABELS[fieldKey] || fieldKey}
                                                        </label>
                                                        {fieldKey.includes("legal_description") ? (
                                                            <textarea
                                                                value={displayValue}
                                                                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                                                rows={3}
                                                                className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary shadow-xs transition-colors focus:border-brand-solid focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                                            />
                                                        ) : fieldKey === "note_amount" ? (
                                                            <div className="relative">
                                                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-tertiary">$</span>
                                                                <input
                                                                    type="text"
                                                                    value={displayValue}
                                                                    onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                                                    className="w-full rounded-lg border border-primary pl-7 pr-3 py-2 text-sm text-primary shadow-xs transition-colors focus:border-brand-solid focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                                                    placeholder="0.00"
                                                                />
                                                            </div>
                                                        ) : isDateField(fieldKey) ? (
                                                            <CustomDatePicker
                                                                value={displayValue || null}
                                                                onChange={(val) => handleDateChange(fieldKey, val)}
                                                                minYear={new Date().getFullYear() - 100}
                                                                maxYear={new Date().getFullYear() + 50}
                                                            />
                                                        ) : (
                                                            <input
                                                                type="text"
                                                                value={displayValue}
                                                                onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                                                className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary shadow-xs transition-colors focus:border-brand-solid focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                                                placeholder={`Enter ${FIELD_LABELS[fieldKey] || fieldKey}`}
                                                            />
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Confirmation Checkbox */}
                        <label className="mt-8 flex items-start gap-3 cursor-pointer select-none rounded-lg border border-secondary bg-primary p-4">
                            <input
                                type="checkbox"
                                checked={reviewConfirmed}
                                onChange={(e) => setReviewConfirmed(e.target.checked)}
                                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-brand-solid focus:ring-brand-solid shrink-0"
                            />
                            <span className="text-sm text-secondary">
                                I confirm that I have reviewed all information and understand that generated documents rely on the accuracy of the uploaded source documents and my edits.
                            </span>
                        </label>

                        <div className="sticky bottom-0 mt-4 flex items-center justify-between border-t border-secondary bg-secondary py-5">
                            <Button
                                size="md"
                                color="secondary"
                                onClick={handleBack}
                                iconLeading={ArrowLeft}
                            >
                                Back
                            </Button>
                            <div className="flex items-center gap-3">
                                {!canGenerate && validationData && validationData.errors.length > 0 && (
                                    <span className="text-xs text-error-primary">
                                        Fix {validationData.errors.length} error{validationData.errors.length > 1 ? "s" : ""} to generate
                                    </span>
                                )}
                                <Button
                                    size="lg"
                                    onClick={async () => {
                                        setRevalidating(true);
                                        setError(null);
                                        try {
                                            const response = await fetch("/api/foreclosure/validate-only", {
                                                method: "POST",
                                                headers: { "Content-Type": "application/json" },
                                                body: JSON.stringify({ fields: extractedFields }),
                                            });
                                            if (!response.ok) throw new Error("Validation failed");
                                            const data = await response.json();
                                            if (data.success && data.validation) {
                                                setValidationData(data.validation);
                                                setCanGenerate(data.can_generate ?? false);
                                                if (data.can_generate) {
                                                    setCurrentStep(4);
                                                }
                                            }
                                        } catch (err: any) {
                                            setError(err.message || "Validation failed");
                                        } finally {
                                            setRevalidating(false);
                                        }
                                    }}
                                    isDisabled={!reviewConfirmed || revalidating}
                                    iconTrailing={FileCheck02}
                                >
                                    {revalidating ? "Validating..." : "Preview File Abstract"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 4: PDF Preview & Download */}
                {currentStep === 4 && extractedFields && (
                    <div className="flex flex-col">
                        <div className="mb-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <FeaturedIcon color="success" theme="modern" size="md">
                                    <CheckCircle className="size-5" />
                                </FeaturedIcon>
                                <div>
                                    <h1 className="text-display-xs font-semibold text-primary">
                                        File Abstract Preview
                                    </h1>
                                    <p className="text-sm text-tertiary">
                                        Review the generated document. Download as PDF or DOCX, or print directly.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* PDF Preview */}
                        <div className="mb-4 overflow-hidden rounded-xl ring-1 ring-inset ring-secondary" style={{ height: '70vh' }}>
                            <PDFViewer width="100%" height="100%" showToolbar={false}>
                                <FinalResult fields={extractedFields} />
                            </PDFViewer>
                        </div>

                        {/* Action Bar */}
                        <div className="sticky bottom-0 flex items-center justify-between border-t border-secondary bg-secondary py-5">
                            <Button
                                size="md"
                                color="secondary"
                                onClick={handleBack}
                                iconLeading={ArrowLeft}
                            >
                                Edit Fields
                            </Button>
                            <div className="flex items-center gap-3">
                                <BlobProvider document={<FinalResult fields={extractedFields} />}>
                                    {({ blob, loading }) => (
                                        <Button
                                            size="md"
                                            color="secondary"
                                            disabled={loading || !blob}
                                            iconLeading={Printer}
                                            onClick={() => {
                                                if (!blob) return;
                                                const url = URL.createObjectURL(blob);
                                                const printWindow = window.open(url);
                                                if (printWindow) {
                                                    printWindow.addEventListener('load', () => {
                                                        printWindow.print();
                                                    });
                                                }
                                            }}
                                        >
                                            {loading ? "Preparing..." : "Print"}
                                        </Button>
                                    )}
                                </BlobProvider>
                                <BlobProvider document={<FinalResult fields={extractedFields} />}>
                                    {({ blob, loading }) => (
                                        <Button
                                            size="md"
                                            color="secondary"
                                            disabled={loading || !blob}
                                            iconLeading={Download01}
                                            onClick={() => {
                                                if (!blob) return;
                                                const url = URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = extractedFields.common_address
                                                    ? `File Abstract - ${extractedFields.common_address}.pdf`
                                                    : 'File Abstract - Generated.pdf';
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                URL.revokeObjectURL(url);
                                            }}
                                        >
                                            {loading ? "Preparing..." : "Download PDF"}
                                        </Button>
                                    )}
                                </BlobProvider>
                                <Button
                                    size="md"
                                    onClick={handleGenerateDocx}
                                    disabled={generating}
                                    iconLeading={Download01}
                                >
                                    {generating ? "Generating..." : "Download DOCX"}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* SSN Preview Modal */}
            {showSSNModal && fundingPreviewImage && (
                <SSNPreviewModal
                    previewImage={fundingPreviewImage}
                    progress={processingProgress}
                    stage={processingStage}
                    fundingPdfUrl={fundingPdfUrl}
                    onSubmit={handleSSNSubmit}
                    onClose={handleCloseSSNModal}
                />
            )}
        </div>
    );
};

export default ForeclosureForm;
