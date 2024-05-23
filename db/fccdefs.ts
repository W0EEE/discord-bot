const licenseStatuses = {
    'A': 'Active',
    'C': 'Canceled',
    'E': 'Expired',
    'L': 'Pending Legal Status',
    'P': 'Parent Station Canceled',
    'T': 'Terminated',
    'X': 'Term Pending',
};

function licenseStatus(code: string): string {
    return licenseStatuses[code] || `Unknown License Status: ${ code}`;
}

const applicantTypes = {
    'B': 'Amateur Club',
    'C': 'Corporation',
    'D': 'General Partnership',
    'E': 'Limited Partnership',
    'F': 'Limited Liability Partnership',
    'G': 'Governmental Entity',
    'H': 'Other',
    'I': 'Individual',
    'J': 'Joint Venture',
    'L': 'Limited Liability Company',
    'M': 'Military Recreation',
    'O': 'Consortium',
    'P': 'Partnership',
    'R': 'RACES',
    'T': 'Trust',
    'U': 'Unincorporated Association'
};

function applicantType(code: string): string {
    return applicantTypes[code] || `Unknown Applicant Type: ${code}`;
}

const operatorClasses = {
    'A': 'Advanced',
    'E': 'Amateur Extra',
    'G': 'General',
    'N': 'Novice',
    'P': 'Technician Plus',
    'T': 'Technician'
};

function operatorClass(code: string): string {
    return operatorClasses[code] || `Unknown Operator Class: ${code}`;
}

export default {
    licenseStatuses,
    applicantTypes,
    operatorClasses,
    
    licenseStatus,
    applicantType,
    operatorClass
};
