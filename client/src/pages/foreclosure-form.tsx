import { useState, useCallback, useEffect } from "react";
import { ArrowLeft, Download01, File06, CheckCircle, AlertCircle, Zap, Upload01 } from "@untitledui/icons";
import { Button } from "@/components/base/buttons/button";
import { HeaderNavigationBase } from "@/components/application/app-navigation/header-navigation";
import { FileUpload } from "@/components/application/file-upload/file-upload-base";
import { FeaturedIcon } from "@/components/foundations/featured-icon/featured-icon";
import { Badge } from "@/components/base/badges/badges";
import { ProgressBarBase } from "@/components/base/progress-indicators/progress-indicators";

interface ExtractedFields {
    [key: string]: string;
}

const FIELD_LABELS: Record<string, string> = {
    FILE_NAME: "File Name",
    CLIO_NUMBER: "CLIO Number",
    COMMON_ADDRESS: "Common Address",
    GRANTOR_NAME: "Grantor Name",
    GRANTOR_REP: "Grantor Representative",
    GRANTOR_REP_TITLE: "Rep Title",
    GRANTOR_ADDRESS1: "Mailing Address 1",
    GRANTOR_ADDRESS2: "Mailing Address 2",
    GRANTOR_ADDRESS3: "Mailing Address 3",
    GRANTOR_ADDRESS4: "Mailing Address 4",
    EIN: "EIN",
    DL_NUM: "Driver's License #",
    DL_STATE: "DL State",
    DOB: "Date of Birth",
    SSN: "SSN",
    PASSPORT_NUM: "Passport #",
    ORIGINAL_GRANTEE_NAME: "Original Grantee/Lender",
    CURRENT_GRANTEE_NAME: "Current Grantee/Lender",
    SERVICING_AGENT: "Servicing Agent",
    TRUSTEE: "Trustee",
    LOAN_SERVICER: "Loan Servicer",
    LEGAL_DESCRIPTION: "Legal Description (Short)",
    LEGAL_DESCRIPTION_FULL: "Legal Description (Full)",
    DOT_INSTRUMENT_NUM: "DOT Instrument #",
    DOT_EFF_DATE: "DOT Date Signed",
    DOT_R_DATE: "DOT Date Recorded",
    COUNTY: "County",
    AODOT1_INSTRUMENT_NUM: "AODOT1 Instrument #",
    AODOT1_EFF_DATE: "AODOT1 Effective Date",
    AODOT1_R_DATE: "AODOT1 Recording Date",
    AODOT2_INSTRUMENT_NUM: "AODOT2 Instrument #",
    AODOT2_EFF_DATE: "AODOT2 Effective Date",
    AODOT2_R_DATE: "AODOT2 Recording Date",
    AODOT_GRANTOR: "AODOT Grantor",
    AODOT_GRANTEE: "AODOT Grantee",
    ROL1_INSTRUMENT_NUM: "ROL1 Instrument #",
    ROL1_EFF_DATE: "ROL1 Effective Date",
    ROL1_R_DATE: "ROL1 Recording Date",
    ROL2_INSTRUMENT_NUM: "ROL2 Instrument #",
    ROL2_EFF_DATE: "ROL2 Effective Date",
    ROL2_R_DATE: "ROL2 Recording Date",
    NOTE_DATE: "Note Date",
    NOTE_AMOUNT: "Note Amount",
    NOTE_MATURITY_DATE: "Note Maturity Date",
    COUNTY_SEAT: "County Seat",
};

const FIELD_SECTIONS: { title: string; fields: string[] }[] = [
    {
        title: "Property & Case Info",
        fields: ["FILE_NAME", "CLIO_NUMBER", "COMMON_ADDRESS", "COUNTY", "COUNTY_SEAT"],
    },
    {
        title: "Grantor / Borrower",
        fields: ["GRANTOR_NAME", "GRANTOR_REP", "GRANTOR_REP_TITLE"],
    },
    {
        title: "Identification",
        fields: ["EIN", "DL_NUM", "DL_STATE", "DOB", "SSN", "PASSPORT_NUM"],
    },
    {
        title: "Mailing Addresses",
        fields: ["GRANTOR_ADDRESS1", "GRANTOR_ADDRESS2", "GRANTOR_ADDRESS3", "GRANTOR_ADDRESS4"],
    },
    {
        title: "Parties",
        fields: ["ORIGINAL_GRANTEE_NAME", "CURRENT_GRANTEE_NAME", "SERVICING_AGENT", "TRUSTEE", "LOAN_SERVICER"],
    },
    {
        title: "Deed of Trust",
        fields: ["DOT_INSTRUMENT_NUM", "DOT_EFF_DATE", "DOT_R_DATE"],
    },
    {
        title: "Assignments of DOT",
        fields: ["AODOT1_INSTRUMENT_NUM", "AODOT1_EFF_DATE", "AODOT1_R_DATE", "AODOT2_INSTRUMENT_NUM", "AODOT2_EFF_DATE", "AODOT2_R_DATE", "AODOT_GRANTOR", "AODOT_GRANTEE"],
    },
    {
        title: "Releases of Lien",
        fields: ["ROL1_INSTRUMENT_NUM", "ROL1_EFF_DATE", "ROL1_R_DATE", "ROL2_INSTRUMENT_NUM", "ROL2_EFF_DATE", "ROL2_R_DATE"],
    },
    {
        title: "Promissory Note",
        fields: ["NOTE_DATE", "NOTE_AMOUNT", "NOTE_MATURITY_DATE"],
    },
    {
        title: "Legal Description",
        fields: ["LEGAL_DESCRIPTION", "LEGAL_DESCRIPTION_FULL"],
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

const PROCESSING_STEPS = [
    { label: "Uploading documents", duration: 5 },
    { label: "Reading PDF pages with AI", duration: 40 },
    { label: "Extracting fields from documents", duration: 15 },
    { label: "Building File Abstract", duration: 5 },
];

export const ForeclosureForm = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [processing, setProcessing] = useState(false);
    const [processingStepIndex, setProcessingStepIndex] = useState(0);
    const [processingProgress, setProcessingProgress] = useState(0);
    const [extractedFields, setExtractedFields] = useState<ExtractedFields | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (!processing) {
            setProcessingProgress(0);
            setProcessingStepIndex(0);
            return;
        }

        const totalDuration = PROCESSING_STEPS.reduce((sum, s) => sum + s.duration, 0);
        let elapsed = 0;
        for (let i = 0; i < processingStepIndex; i++) {
            elapsed += PROCESSING_STEPS[i].duration;
        }

        const interval = setInterval(() => {
            setProcessingProgress(prev => {
                const stepEnd = ((elapsed + (PROCESSING_STEPS[processingStepIndex]?.duration || 0)) / totalDuration) * 100;
                const next = prev + 0.5;
                if (next >= stepEnd - 2) return stepEnd - 2;
                return Math.min(next, 95);
            });
        }, 300);

        return () => clearInterval(interval);
    }, [processing, processingStepIndex]);

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
        setProcessingStepIndex(0);
        setProcessingProgress(0);

        try {
            const formData = new FormData();
            selectedFiles.forEach(file => formData.append("files", file));

            setProcessingStepIndex(1);

            const response = await fetch("/api/foreclosure/process", {
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Processing failed");
            }

            setProcessingStepIndex(2);
            const data = await response.json();

            if (data.success && data.fields) {
                setProcessingStepIndex(3);
                setProcessingProgress(100);
                await new Promise(resolve => setTimeout(resolve, 600));
                setExtractedFields(data.fields);
                setCurrentStep(2);
            } else {
                throw new Error("No fields returned from processing");
            }
        } catch (err: any) {
            setError(err.message || "An error occurred during processing");
        } finally {
            setProcessing(false);
        }
    };

    const handleFieldChange = (key: string, value: string) => {
        if (!extractedFields) return;
        setExtractedFields({ ...extractedFields, [key]: value });
    };

    const handleGenerateDocx = async () => {
        if (!extractedFields) return;

        setGenerating(true);
        setError(null);

        try {
            const response = await fetch("/api/foreclosure/generate-docx", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: extractedFields }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "DOCX generation failed");
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = extractedFields.FILE_NAME
                ? `File Abstract - ${extractedFields.FILE_NAME}.docx`
                : "File Abstract - Generated.docx";
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            setCurrentStep(3);
        } catch (err: any) {
            setError(err.message || "Failed to generate document");
        } finally {
            setGenerating(false);
        }
    };

    const handleBack = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };

    const navItems: any[] = [];
    const filledCount = extractedFields
        ? Object.values(extractedFields).filter(v => v && v.trim() !== "").length
        : 0;
    const totalFields = extractedFields ? Object.keys(extractedFields).length : 0;

    const totalFileSize = selectedFiles.reduce((sum, f) => sum + f.size, 0);

    const steps = [
        { num: 1, label: "Upload Documents" },
        { num: 2, label: "Review & Edit" },
        { num: 3, label: "Generate" },
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
                        {steps.map(({ num, label }, idx) => {
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
                                                num
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
                            </p>
                        </div>

                        {/* Processing steps */}
                        <div className="w-full max-w-sm space-y-3">
                            {PROCESSING_STEPS.map((step, idx) => {
                                const isActive = idx === processingStepIndex;
                                const isDone = idx < processingStepIndex;
                                return (
                                    <div
                                        key={step.label}
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
                                            {step.label}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>

                        <p className="mt-8 text-xs text-quaternary">
                            Do not close this page while processing
                        </p>
                    </div>
                )}

                {/* Step 2: Review Extracted Fields */}
                {currentStep === 2 && extractedFields && (
                    <div>
                        <div className="mb-6 flex items-center gap-3">
                            <FeaturedIcon color="brand" theme="modern" size="md">
                                <File06 className="size-5" />
                            </FeaturedIcon>
                            <div>
                                <h1 className="text-display-xs font-semibold text-primary">
                                    Review Extracted Fields
                                </h1>
                                <p className="text-sm text-tertiary">
                                    {filledCount} of {totalFields} fields extracted. Review and edit before generating the File Abstract.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            {FIELD_SECTIONS.map((section) => {
                                const sectionHasData = section.fields.some(
                                    (f) => extractedFields[f] && extractedFields[f].trim() !== ""
                                );
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
                                            {section.fields.map((fieldKey) => (
                                                <div key={fieldKey}>
                                                    <label className="mb-1.5 block text-xs font-medium text-tertiary">
                                                        {FIELD_LABELS[fieldKey] || fieldKey}
                                                    </label>
                                                    {fieldKey.includes("LEGAL_DESCRIPTION") ? (
                                                        <textarea
                                                            value={extractedFields[fieldKey] || ""}
                                                            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                                            rows={3}
                                                            className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary shadow-xs transition-colors focus:border-brand-solid focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                                        />
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={extractedFields[fieldKey] || ""}
                                                            onChange={(e) => handleFieldChange(fieldKey, e.target.value)}
                                                            className="w-full rounded-lg border border-primary px-3 py-2 text-sm text-primary shadow-xs transition-colors focus:border-brand-solid focus:outline-none focus:ring-1 focus:ring-brand-solid"
                                                            placeholder={`Enter ${FIELD_LABELS[fieldKey] || fieldKey}`}
                                                        />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="sticky bottom-0 mt-8 flex items-center justify-between border-t border-secondary bg-secondary py-5">
                            <Button
                                size="md"
                                color="secondary"
                                onClick={handleBack}
                                iconLeading={ArrowLeft}
                            >
                                Back
                            </Button>
                            <Button
                                size="lg"
                                onClick={handleGenerateDocx}
                                disabled={generating}
                                iconTrailing={Download01}
                            >
                                {generating ? "Generating..." : "Generate File Abstract"}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Step 3: Download Complete */}
                {currentStep === 3 && (
                    <div className="flex flex-col items-center py-8">
                        <FeaturedIcon color="success" theme="light" size="xl" className="mb-5">
                            <CheckCircle className="size-7" />
                        </FeaturedIcon>

                        <h1 className="mb-2 text-display-xs font-semibold text-primary">
                            File Abstract Generated
                        </h1>
                        <p className="mb-8 max-w-md text-center text-sm text-tertiary">
                            Your File Abstract DOCX has been downloaded. Open it in Word to review and make final adjustments.
                        </p>

                        <div className="w-full max-w-md rounded-xl bg-primary p-6 ring-1 ring-inset ring-secondary mb-8">
                            <h3 className="mb-4 text-sm font-semibold text-secondary">
                                Summary
                            </h3>
                            <div className="space-y-3">
                                {[
                                    { label: "Property", value: extractedFields?.FILE_NAME || extractedFields?.COMMON_ADDRESS || "N/A" },
                                    { label: "Grantor", value: extractedFields?.GRANTOR_NAME || "N/A" },
                                    { label: "County", value: extractedFields?.COUNTY || "N/A" },
                                    { label: "Fields Filled", value: `${filledCount} of ${totalFields}` },
                                ].map(({ label, value }) => (
                                    <div key={label} className="flex items-center justify-between">
                                        <span className="text-sm text-tertiary">{label}</span>
                                        <span className="text-sm font-medium text-secondary">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex w-full max-w-md items-center justify-between border-t border-secondary pt-6">
                            <Button
                                size="md"
                                color="secondary"
                                onClick={handleBack}
                                iconLeading={ArrowLeft}
                            >
                                Edit Fields
                            </Button>
                            <div className="flex gap-3">
                                <Button
                                    size="md"
                                    color="secondary"
                                    onClick={handleGenerateDocx}
                                    iconLeading={Download01}
                                >
                                    Download Again
                                </Button>
                                <Button size="md" onClick={() => (window.location.href = "/dashboard")}>
                                    Dashboard
                                </Button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};
