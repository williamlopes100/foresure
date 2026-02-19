import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  BorderStyle,
  SectionType,
  convertInchesToTwip,
} from 'docx';
import { saveAs } from 'file-saver';

function hr(): Paragraph {
  return new Paragraph({
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 1, color: '000000' },
    },
    spacing: { before: 120, after: 120 },
  });
}

function boldLabel(label: string, value: string): Paragraph {
  return new Paragraph({
    spacing: { after: 100 },
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' }),
      new TextRun({ text: value, size: 20, font: 'Calibri' }),
    ],
  });
}

function indentLine(label: string, value: string): Paragraph {
  return new Paragraph({
    indent: { left: convertInchesToTwip(0.4) },
    spacing: { after: 60 },
    children: [
      new TextRun({ text: label, bold: true, size: 20, font: 'Calibri' }),
      new TextRun({ text: value, size: 20, font: 'Calibri' }),
    ],
  });
}

function sectionHeading(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 160, after: 60 },
    children: [
      new TextRun({ text, bold: true, underline: {}, size: 20, font: 'Calibri' }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    indent: { left: convertInchesToTwip(0.5) },
    spacing: { after: 30 },
    children: [
      new TextRun({ text: `\u2022 ${text}`, size: 20, font: 'Calibri' }),
    ],
  });
}

function plainPara(text: string, spacing?: { before?: number; after?: number }): Paragraph {
  return new Paragraph({
    spacing: { after: 100, ...spacing },
    children: [
      new TextRun({ text, size: 20, font: 'Calibri' }),
    ],
  });
}

export function generateDocx(fields: Record<string, any>): Document {
  const f = fields;
  const trustees = Array.isArray(f.servicelink_trustees)
    ? f.servicelink_trustees.join(', ')
    : f.servicelink_trustees || '';
  const noteAmount = f.note_amount || '';
  const county = f.county || '_____________';
  const legalRecording = f.legal_description_recording || '';
  const legalMetes = f.legal_description_metes_bounds || f.legal_description_recording || '';
  const svcDate = f.servicelink_date || '_______________';
  const _ = '_________________';

  const page1: Paragraph[] = [
    // Header
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 40 },
      children: [
        new TextRun({ text: `${f.common_address || ''} (on DOT)`, bold: true, size: 20, font: 'Calibri' }),
      ],
    }),
    hr(),

    // GRANTOR
    boldLabel('GRANTOR: ', f.grantor_name || ''),
    plainPara(`${f.grantor_name || ''} c/o ${f.grantor_rep || ''}, ${f.grantor_rep_title || ''}`),
    plainPara('Use the following for Title Search Request:'),
    new Paragraph({
      indent: { left: convertInchesToTwip(0.4) },
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `${f.grantor_name || ''} ("Borrower") by ${f.grantor_rep || ''}, ${f.grantor_rep_title || ''}`, size: 20, font: 'Calibri' }),
      ],
    }),

    // Identity bullets
    bullet(`EIN: ${f.ein || _}`),
    bullet(`DOB: ${f.dob || _}`),
    bullet(`SSN: ${f.ssn || _}`),
    hr(),

    // ORIGINAL GRANTEE
    boldLabel('ORIGINAL GRANTEE/LENDER/BENEFICIARY: ', `${f.original_grantee || ''}, as to an undivided 100% Interest`),

    // CURRENT GRANTEE
    boldLabel('CURRENT GRANTEE/LENDER/BENEFICIARY: ', f.current_grantee || ''),

    // TRUSTEE
    boldLabel('TRUSTEE: ', f.trustee || ''),
    hr(),

    // Legal Description
    sectionHeading('Legal Description'),
    plainPara(
      `${legalRecording}${legalRecording ? ' and being more particularly described by metes and bounds in the attached Exhibit "A"' : ''} and more commonly known as ${f.common_address || ''}`
    ),
    hr(),

    // DOT
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'DOT: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: `Instrument # ${f.dot_instrument_number || _}, dated/signed on ${f.dot_effective_date || _}, and recorded on ${f.dot_recording_date || _}, in the official Real Property (Deed) Records of ${county} County, Texas.`, size: 20, font: 'Calibri' }),
      ],
    }),

    // NOTE
    new Paragraph({
      spacing: { after: 100 },
      children: [
        new TextRun({ text: 'NOTE: ', bold: true, size: 20, font: 'Calibri' }),
        new TextRun({ text: `${f.note_date || _}; ${noteAmount}, by Borrower`, size: 20, font: 'Calibri' }),
      ],
    }),
  ];

  const page2: Paragraph[] = [
    // Deed of Trust
    sectionHeading('Deed of Trust:'),
    indentLine('Dated: ', f.dot_effective_date || _),
    indentLine('Grantor: ', f.grantor_name || ''),
    indentLine('Trustee: ', f.trustee || ''),
    indentLine('Lender: ', f.original_grantee || ''),
    indentLine('Loan Servicer: ', f.loan_servicer || ''),
    indentLine('Recorded: ', `Instrument # ${f.dot_instrument_number || _}, recorded on ${f.dot_recording_date || _}, in the official Real Property (Deed) Records of ${county} County, Texas`),
    indentLine('Secures: ', `Promissory Note ("Note") dated ${f.note_date || _}, in the original principal amount of ${noteAmount}, executed by ${f.grantor_rep || ''}, ${f.grantor_rep_title || ''}, on behalf of ${f.grantor_name || ''} ("Borrower") and payable to the order of Lender`),
    indentLine('Maturity Date: ', f.note_maturity_date || _),
    indentLine('Interest Rate: ', f.interest_rate || _),
    indentLine('Legal Description: ', `${legalRecording}${legalRecording ? ', and being more particularly described by metes and bounds in the attached Exhibit "A"' : ''} and more commonly known as ${f.common_address || ''}`),
    hr(),

    // Promissory Note
    sectionHeading('Promissory Note:'),
    new Paragraph({
      indent: { left: convertInchesToTwip(0.4) },
      spacing: { after: 100 },
      children: [
        new TextRun({ text: `Dated ${f.note_date || _}; ${noteAmount}, by ${f.grantor_rep || ''}, ${f.grantor_rep_title || ''}, on behalf of ${f.grantor_name || ''} ("Borrower") and payable to the order of Lender`, size: 20, font: 'Calibri' }),
      ],
    }),
    hr(),

    // Substitute Trustees
    sectionHeading('Substitute Trustees'),
    plainPara(`Bennett M. Wyse, Ted Gambordella, ${trustees} (as of ${svcDate}, ASAP SvcLink List)`),
    hr(),

    // Time and Place for Fc Sale
    sectionHeading('Time and Place for Fc Sale'),
    plainPara(`${county} County (The City of ${f.county_seat || _} is the county seat)`),
    plainPara(f.sale_hours || _),
    plainPara(`${f.sale_location || _}, OR IF THE PRECEDING AREA IS NO LONGER THE DESIGNATED AREA, AT THE AREA MOST RECENTLY DESIGNATED BY THE ${county.toUpperCase()} COUNTY COMMISSIONERS COURT`),
    hr(),

    // Exhibit "A"
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 120 },
      children: [
        new TextRun({ text: 'EXHIBIT "A"', bold: true, underline: {}, size: 22, font: 'Calibri' }),
      ],
    }),
    plainPara(legalMetes || 'Legal description not available.'),
  ];

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children: page1,
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: {
            size: { width: convertInchesToTwip(8.5), height: convertInchesToTwip(11) },
            margin: {
              top: convertInchesToTwip(0.7),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.75),
              right: convertInchesToTwip(0.75),
            },
          },
        },
        children: page2,
      },
    ],
  });
}

export async function downloadDocx(fields: Record<string, any>): Promise<void> {
  const doc = generateDocx(fields);
  const blob = await Packer.toBlob(doc);
  const fileName = fields.common_address
    ? `File Abstract - ${fields.common_address}.docx`
    : 'File Abstract - Generated.docx';
  saveAs(blob, fileName);
}
