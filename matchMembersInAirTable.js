// helper functions
// TODO: comprhensive tests on this regex
const validEmail = (email => {
    if (!email) { return false; }
    const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(String(email).toLowerCase());
});

const validPhone = (phone => {
    if (!String(phone)) { return false; }
    const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
    return re.test(String(phone));
});

const isUnmatchable = (({ email, phone, firstName }) => {
    return !firstName || (!validEmail(email) && !validPhone(phone));
});

const normalizePhone = (phone => !phone ? "" : String(phone).replace(/[^\d+]+/g, '') );

const normalizeText = (text => !text ? "" : String(text).toLowerCase() );

const phoneMatch = (({ memberPhone, unmatchedPhone }) =>  {
    return validPhone(memberPhone) && validPhone(unmatchedPhone) && (memberPhone == unmatchedPhone)
});

const emailMatch = (({ memberEmail, unmatchedEmail }) => {
    return validEmail(memberEmail) && validEmail(unmatchedEmail) && (memberEmail == unmatchedEmail)
});

const firstNameMatch = (( {memberFirstName, unmatchedFirstName }) => {
    if (!memberFirstName || !unmatchedFirstName ) { return false; }
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
// TODO: cleanup membershipTableFields - extract to object?
const membershipTableFirstNameField = "First Name";
const membershipTableLastNameField = "Last Name";
const membershipTablePhoneFields = { primary: "Primary Phone" };
const membershipTableEmailFields = { primary: "Primary Email" };
const membershipTableFields = [membershipTableFirstNameField].concat(
        membershipTableLastNameField, 
        membershipTablePhoneFields.primary,
        membershipTableEmailFields.primary);
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

    console.log(`Attempting to match ${unmatchedRecords.length} records from ${tableData.viewName} in ${tableData.name} table. `)
    
    let matchedRecords = 0;
    let newRecords = 0;
    let unmatchableRecords = 0;
    // for each unmatched record in table
    for (let x = 0; x < unmatchedRecords.length; x++) {
        let unmatchedRecord = unmatchedRecords[x];
        let unmatchedFirstName = normalizeText(unmatchedRecord.getCellValue(tableData.firstNameField));
        let unmatchedEmail = normalizeText(unmatchedRecord.getCellValue(tableData.emailField));
        let unmatchedPhone = normalizePhone(unmatchedRecord.getCellValue(tableData.phoneField));
        console.log("unmatchedPhone: ", unmatchedPhone)
        if (isUnmatchable({ email: unmatchedEmail, phone: unmatchedPhone, firstName: unmatchedFirstName })) {
            unmatchableRecords += 1;
            continue;
        }

        let match;
        // find a match in the Membership Table
        for (let y = 0; y < existingMembers.length; y++) {
            let member = existingMembers[y];
            let memberFirstName = normalizeText(member.getCellValue(membershipTableFirstNameField));
            let memberEmail = normalizeText(member.getCellValue(membershipTableEmailFields.primary));
            let memberPhone = normalizePhone(member.getCellValue(membershipTablePhoneFields.primary));
            
            if (isUnmatchable({ email: memberEmail, phone: memberPhone, firstName: memberFirstName })) {
                continue;
            }

            if (phoneMatch({memberPhone, unmatchedPhone})) {
                console.log('phone match')
            }

            if (phoneMatch({memberPhone, unmatchedPhone}) && emailMatch({ memberEmail, unmatchedEmail})) {
                match = member; 
                break;
            } else if (phoneMatch({memberPhone, unmatchedPhone}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
                match = member
            } else if (match == undefined && emailMatch({memberEmail, unmatchedEmail}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
                match = member
            }
        };

        let matchId;
        // create the record if there is no match
        if (match == undefined) {
            let newMemberFields = {
                    [membershipTableFirstNameField]: unmatchedRecord.getCellValue(tableData.firstNameField),
                    [membershipTableLastNameField]: unmatchedRecord.getCellValue(tableData.lastNameField),
            }

            if (validEmail(unmatchedEmail))  { newMemberFields[membershipTableEmailFields.primary] = unmatchedEmail; }
            if (validPhone(unmatchedPhone)) { newMemberFields[membershipTablePhoneFields.primary] = unmatchedPhone; }

            matchId = await existingMembersTable.createRecordAsync(newMemberFields);
            newRecords += 1;
        } else {
            // TODO: also update existing record's information?
            matchId = match.id
            matchedRecords += 1;
        }
        
        // link the member record to match from Member List
        let table = base.getTable(tableData.id);
        await table.updateRecordAsync(unmatchedRecord.id, {
            [tableData.memberLinkField]: [{ id: matchId}]
        });

    }

    console.log(`matched ${matchedRecords} with existing records and created ${newRecords} new records. There were ${unmatchableRecords} unmatchable records`)
};
