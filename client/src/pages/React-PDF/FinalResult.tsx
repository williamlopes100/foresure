import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

const s = StyleSheet.create({
  page: {
    paddingTop: 50,
    paddingBottom: 60,
    paddingHorizontal: 55,
    fontSize: 10,
    lineHeight: 1.55,
    color: '#000',
  },
  // Header block
  headerLine: {
    textAlign: 'center',
    fontWeight: 'bold',
    fontSize: 10,
    marginBottom: 2,
  },
  headerAddress: {
    textAlign: 'center',
    fontSize: 10,
    marginBottom: 4,
  },
  // Section labels (bold inline prefix)
  bold: {
    fontWeight: 'bold',
  },
  underline: {
    textDecoration: 'underline',
  },
  boldUnderline: {
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  paragraph: {
    marginBottom: 8,
  },
  indent: {
    marginLeft: 20,
    marginBottom: 4,
  },
  indentDouble: {
    marginLeft: 40,
    marginBottom: 4,
  },
  sectionHeading: {
    fontWeight: 'bold',
    textDecoration: 'underline',
    fontSize: 10,
    marginTop: 10,
    marginBottom: 4,
  },
  bullet: {
    marginLeft: 30,
    marginBottom: 2,
  },
  separator: {
    borderBottom: '1px solid #000',
    marginVertical: 8,
  },
  exhibitHeading: {
    fontWeight: 'bold',
    textDecoration: 'underline',
    textAlign: 'center',
    fontSize: 11,
    marginTop: 14,
    marginBottom: 8,
  },
  legalText: {
    lineHeight: 1.6,
    textAlign: 'justify',
  },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 55,
    right: 55,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#888',
  },
});

interface FinalResultProps {
  fields: Record<string, any>;
}

const B = ({ children }: { children: React.ReactNode }) => <Text style={s.bold}>{children}</Text>;

const FinalResult = ({ fields }: FinalResultProps) => {
  const f = fields;
  const trustees = Array.isArray(f.servicelink_trustees)
    ? f.servicelink_trustees.join(', ')
    : f.servicelink_trustees || '';
  const noteAmount = f.note_amount || '';
  const county = f.county || '_____________';
  const legalRecording = f.legal_description_recording || '';
  const legalMetes = f.legal_description_metes_bounds || f.legal_description_recording || '';
  const svcDate = f.servicelink_date || '_______________';

  return (
    <Document title={`File Abstract - ${f.common_address || 'Generated'}`} author="ForeSure">
      {/* ── PAGE 1: FILE ABSTRACT ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.headerLine}>{f.common_address || ''} (on DOT)</Text>
        <View style={s.separator} />

        {/* GRANTOR */}
        <View style={s.paragraph}>
          <Text>
            <B>GRANTOR: </B>{f.grantor_name || ''}
          </Text>
        </View>

        <View style={s.paragraph}>
          <Text>
            {f.grantor_name || ''} c/o {f.grantor_rep || ''}, {f.grantor_rep_title || ''}
          </Text>
        </View>

        <View style={s.paragraph}>
          <Text>
            Use the following for Title Search Request:
          </Text>
          <Text style={s.indent}>
            {f.grantor_name || ''} ({'"'}Borrower{'"'}) by {f.grantor_rep || ''}, {f.grantor_rep_title || ''}
          </Text>
        </View>

        {/* Identity bullets */}
        <View style={s.bullet}>
          <Text>{'\u2022'} EIN: {f.ein || '_________________'}</Text>
        </View>
        <View style={s.bullet}>
          <Text>{'\u2022'} DOB: {f.dob || '_________________'}</Text>
        </View>
        <View style={s.bullet}>
          <Text>{'\u2022'} SSN: {f.ssn || '_________________'}</Text>
        </View>

        <View style={s.separator} />

        {/* ORIGINAL GRANTEE */}
        <View style={s.paragraph}>
          <Text>
            <B>ORIGINAL GRANTEE/LENDER/BENEFICIARY: </B>{f.original_grantee || ''}, as to an undivided 100% Interest
          </Text>
        </View>

        {/* CURRENT GRANTEE */}
        <View style={s.paragraph}>
          <Text>
            <B>CURRENT GRANTEE/LENDER/BENEFICIARY: </B>{f.current_grantee || ''}
          </Text>
        </View>

        {/* TRUSTEE */}
        <View style={s.paragraph}>
          <Text>
            <B>TRUSTEE: </B>{f.trustee || ''}
          </Text>
        </View>

        <View style={s.separator} />

        {/* LEGAL DESCRIPTION */}
        <View style={s.paragraph}>
          <Text style={s.sectionHeading}>Legal Description</Text>
          <Text style={s.legalText}>
            {legalRecording}{legalRecording ? ' and being more particularly described by metes and bounds in the attached Exhibit "A"' : ''} and more commonly known as {f.common_address || ''}
          </Text>
        </View>

        <View style={s.separator} />

        {/* DOT */}
        <View style={s.paragraph}>
          <Text>
            <B>DOT: </B>Instrument # {f.dot_instrument_number || '_________________'}, dated/signed on {f.dot_effective_date || '_________________'}, and recorded on {f.dot_recording_date || '_________________'}, in the official Real Property (Deed) Records of {county} County, Texas.
          </Text>
        </View>

        {/* NOTE */}
        <View style={s.paragraph}>
          <Text>
            <B>NOTE: </B>{f.note_date || '_________________'}; {noteAmount}, by Borrower
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>Generated by ForeSure</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ── PAGE 2: DEED OF TRUST DETAIL ── */}
      <Page size="LETTER" style={s.page}>
        <Text style={s.sectionHeading}>Deed of Trust:</Text>

        <View style={s.indent}>
          <Text><B>Dated: </B>{f.dot_effective_date || '_________________'}</Text>
        </View>
        <View style={s.indent}>
          <Text><B>Grantor: </B>{f.grantor_name || ''}</Text>
        </View>
        <View style={s.indent}>
          <Text><B>Trustee: </B>{f.trustee || ''}</Text>
        </View>
        <View style={s.indent}>
          <Text><B>Lender: </B>{f.original_grantee || ''}</Text>
        </View>
        <View style={s.indent}>
          <Text><B>Loan Servicer: </B>{f.loan_servicer || ''}</Text>
        </View>
        <View style={s.indent}>
          <Text>
            <B>Recorded: </B>Instrument # {f.dot_instrument_number || '_________________'}, recorded on {f.dot_recording_date || '_________________'}, in the official Real Property (Deed) Records of {county} County, Texas
          </Text>
        </View>
        <View style={s.indent}>
          <Text>
            <B>Secures: </B>Promissory Note ({'"'}Note{'"'}) dated {f.note_date || '_________________'}, in the original principal amount of {noteAmount}, executed by {f.grantor_rep || ''}, {f.grantor_rep_title || ''}, on behalf of {f.grantor_name || ''} ({'"'}Borrower{'"'}) and payable to the order of Lender
          </Text>
        </View>
        <View style={s.indent}>
          <Text><B>Maturity Date: </B>{f.note_maturity_date || '_________________'}</Text>
        </View>
        <View style={s.indent}>
          <Text><B>Interest Rate: </B>{f.interest_rate || '_________________'}</Text>
        </View>
        <View style={s.indent}>
          <Text>
            <B>Legal Description: </B>{legalRecording}{legalRecording ? ', and being more particularly described by metes and bounds in the attached Exhibit "A"' : ''} and more commonly known as {f.common_address || ''}
          </Text>
        </View>

        <View style={s.separator} />

        {/* PROMISSORY NOTE */}
        <Text style={s.sectionHeading}>Promissory Note:</Text>
        <View style={s.indent}>
          <Text>
            Dated {f.note_date || '_________________'}; {noteAmount}, by {f.grantor_rep || ''}, {f.grantor_rep_title || ''}, on behalf of {f.grantor_name || ''} ({'"'}Borrower{'"'}) and payable to the order of Lender
          </Text>
        </View>

        <View style={s.separator} />

        {/* SUBSTITUTE TRUSTEES */}
        <Text style={s.sectionHeading}>Substitute Trustees</Text>
        <View style={s.paragraph}>
          <Text>
            Bennett M. Wyse, Ted Gambordella, {trustees} (as of {svcDate}, ASAP SvcLink List)
          </Text>
        </View>

        <View style={s.separator} />

        {/* TIME AND PLACE FOR FC SALE */}
        <Text style={s.sectionHeading}>Time and Place for Fc Sale</Text>
        <View style={s.paragraph}>
          <Text>
            {county} County (The City of {f.county_seat || '_________________'} is the county seat)
          </Text>
        </View>
        <View style={s.paragraph}>
          <Text>{f.sale_hours || '_________________'}</Text>
        </View>
        <View style={s.paragraph}>
          <Text>
            {f.sale_location || '_________________'}, OR IF THE PRECEDING AREA IS NO LONGER THE DESIGNATED AREA, AT THE AREA MOST RECENTLY DESIGNATED BY THE {county.toUpperCase()} COUNTY COMMISSIONERS COURT
          </Text>
        </View>

        {/* EXHIBIT "A" */}
        <Text style={s.exhibitHeading}>EXHIBIT {'"'}A{'"'}</Text>

        <Text style={s.legalText}>
          {legalMetes || 'Legal description not available.'}
        </Text>

        <View style={s.footer} fixed>
          <Text>Generated by ForeSure</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
};

export default FinalResult;
