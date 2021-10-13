// helper functions
// TODO: comprhensive tests on this regex
const validEmail = (email => {
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
});

// TODO: don't need to lowercase twice, don't need to check for non digits if we normalize
const validPhone = (phone => {
    const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
    return re.test(String(phone));
});

const isUnmatchable = (({ email, phone, firstName }) => {
    return firstName.length == 0 && (!validEmail(email) && !validPhone(phone));
});

// TODO: should we replace phone numbers and emails with noramlized phone numbers?
const normalizePhone = (phone => {
    return phone.replace(/[^\d+]+/g, '');
});

const phoneMatch = ((memberPhone, unmatchedPhone) =>  {
    return validPhone(memberPhone) && validPhone(unmatchedPhone) && (memberPhone == unmatchedPhone)
});

const emailMatch = ((memberEmail, unmatchedEmail) => {
    return validEmail(memberEmail) && validEmail(unmatchedEmail) && (memberEmail == unmatchedEmail)
});

const firstNameMatch = ((memberFirstName, unmatchedFirstName) => {
    if (unmatchedFirstName.length == 0 ) { return false; }
    const lengthToMatch = unmatchedFirstName.length < 3 ? unmatchedFirstName.length : 3
    return memberFirstName.slice(0,lengthToMatch) == unmatchedFirstName.slice(0,lengthToMatch)
});


// constants
const tablesWithUnmatchedRecords = [
    {
        id: "tbl4SUPc7SXFxZai0",
        name: "Event Sign Up",
        viewName: "unmatched_records",
        memberLinkField: "Member",
        firstNameField: "Form First Name",
        lastNameField: "Form Last Name",
        phoneField: "Form Phone",
        emailField: "Form Email"
    }
];

// TODO: validate fields in tables exist, raise error if not
// TODO: check if the updated_at field before trying to match to make sure this record is not in the process of being edited
const membershipTable = { id: "tblzh5Ri7S1QnQ1t3", name: "Member List"};
// TODO: cleanup - extract to object?
const membershipTableFirstNameField = "First Name";
const membershipTableLastNameField = "Last Name";
const membershipTablePhoneFields = { primary: "Primary Phone" };
const membershipTableEmailFields = { primary: "Primary Email" };
const membershipTableFields = [membershipTableFirstNameField].concat(
        membershipTableLastNameField, 
        membershipTablePhoneFields.primary,
        membershipTableEmailFields.pimary);
const existingMembersTable = base.getTable(membershipTable.id);
const existingMembers = await existingMembersTable.selectRecordsAsync(
    { fields: membershipTableFields }
).then(queryResult => queryResult.records);;

// for each table with unmatched records
for (let i = 0; i < tablesWithUnmatchedRecords.length; i++) {
    let tableData = tablesWithUnmatchedRecords[i];
    let view = base.getTable(tableData.id).getView(tableData.viewName);
    let unmatchedRecords = await view.selectRecordsAsync(
        { fields: [
                tableData.firstNameField, 
                tableData.lastNameField, 
                tableData.emailField, 
                tableData.phoneField
            ]
        }
    ).then(queryResult => queryResult.records);

    // for each unmatched record in table
    for (let x = 0; x < unmatchedRecords.length; x++) {
        let unmatchedRecord = unmatchedRecords[x];
        let unmatchedFirstName = unmatchedRecord.getCellValue(tableData.firstNameField).toLowerCase();
        // Last name is not currently used
        let unmatchedLastName = unmatchedRecord.getCellValue(tableData.lastNameField);
        let unmatchedEmail = unmatchedRecord.getCellValue(tableData.emailField).toLowerCase();
        let unmatchedPhone = normalizePhone(unmatchedRecord.getCellValue(tableData.phoneField));

        if (isUnmatchable({ email: unmatchedEmail, phone: unmatchedPhone, firstName: unmatchedFirstName })) {
            continue;
        }

        var match;
        // find a match in the Membership Table
        for (let y = 0; y < existingMembers.length; y++) {
            let member = existingMembers[y];
            let memberFirstName = member.getCellValue(tableData.firstNameField).toLowerCase();
            // Last name is not currently used
            // let memberLastName = member.getCellValue(tableData.lastNameField);
            let memberEmail = member.getCellValue(tableData.emailField).toLowerCase();
            let memberPhone = normalizePhone(member.getCellValue(tableData.phoneField));
            
            if (isUnmatchable({ email: memberEmail, phone: memberPhone, firstName: memberFirstName })) {
                continue;
            }
 
            if (phoneMatch({memberPhone, unmatchedPhone}) && emailMatch({ memberEmail, unmatchedEmail})) {
                match = member; 
                break;
            } else if (phoneMatch({memberPhone, unmatchedPhone}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
                match = member
            } else if (!match && emailMatch({memberEmail, unmatchedEmail}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
                match = member
            }
        };

        let matchId;
        // create the record if there is no match
        if (!match) {
            // TODO: only input real phones and emails
            matchId = await existingMembersTable.createRecordAsync({
                fields: {
                    [membershipTableFirstNameField]: unmatchedFirstName,
                    [membershipTableLastNameField]: unmatchedLastName,
                    [membershipTableEmailFields.primary]: unmatchedEmail,
                    [membershipTablePhoneFields.primary]: unmatchedPhone
                }
            });
        } else {
            matchId = match.id
        }
        // link the member record to match from Member List
        // TODO: also update existing record's information?
        let table = base.getTable(tableData.id);
        await table.updateRecordAsync(unmatchedRecord.id, {
            [tableData.memberLinkField]: matchId
        });

    }
};
