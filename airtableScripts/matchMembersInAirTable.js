// KEEP ME UP TO DATE IN GITHUB:
// ALL Changes should be copied to https://github.com/jacobleecd/SURJ-at-sacred-heart/blob/main/airtableScripts/matchMembersInAirTable.js

// helper functions
// TODO: Update to use batch operations.

const validEmail = (email => {
 if (!email) { return false; }
 const re = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
 return re.test(email.toLowerCase());
});

const validPhone = (phone => {
 if (!phone) { return false; }
 const re = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/im
 return re.test(phone);
});

const isUnmatchable = (({ email, phone, firstName }) => {
 return !firstName && !validEmail(email) && !validPhone(phone);
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

// class allows us to use getCellValue function
class PsuedoAirTableRecord {
 constructor(fields) {
     Object.keys(fields).forEach(field => {
         this[field] = fields[field]
     });
 }

 getCellValue(field) {
     return this[field];
 }
}


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
 },
 {
     id: "tblLerTL3D3ZjfVgC",
     name: "1:1 Sign Up",
     viewName: "unmatched_records",
     memberLinkField: "Member",
     firstNameField: "First Name",
     lastNameField: "Last Name",
     phoneField: "Phone",
     emailField: "Email"
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
let existingMembers = await existingMembersTable.selectRecordsAsync(
 { fields: membershipTableFields }
).then(queryResult => queryResult.records).then(records => records.slice());


// for each table with unmatched records
for (let i = 0; i < tablesWithUnmatchedRecords.length; i++) {
 let tableData = tablesWithUnmatchedRecords[i];
 let table = base.getTable(tableData.id)
 let view = table.getView(tableData.viewName);
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

     if (isUnmatchable({ email: unmatchedEmail, phone: unmatchedPhone, firstName: unmatchedFirstName })) {
         unmatchableRecords += 1;
         continue;
     }

     let matchId;
     // find a match in the Membership Table
     for (let y = 0; y < existingMembers.length; y++) {
         // if this is an AirTable Record then getCellValue, otherwise access by object.id
         
         let member = existingMembers[y];
         let memberFirstName = normalizeText(member.getCellValue(membershipTableFirstNameField));
         let memberEmail = normalizeText(member.getCellValue(membershipTableEmailFields.primary));
         let memberPhone = normalizePhone(member.getCellValue(membershipTablePhoneFields.primary));
         
         if (isUnmatchable({ email: memberEmail, phone: memberPhone, firstName: memberFirstName })) {
             continue;
         }

         if (phoneMatch({memberPhone, unmatchedPhone}) && emailMatch({ memberEmail, unmatchedEmail})) {
             matchId = member.id; 
             break;
         } else if (phoneMatch({memberPhone, unmatchedPhone}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
             matchId = member.id;
         } else if (matchId == undefined && emailMatch({memberEmail, unmatchedEmail}) && firstNameMatch({memberFirstName, unmatchedFirstName})) {
             matchId = member.id;
         }
     };

     // create the record if there is no match
     if (!matchId) {
         let newMemberFields = {
             [membershipTableFirstNameField]: unmatchedRecord.getCellValue(tableData.firstNameField),
             [membershipTableLastNameField]: unmatchedRecord.getCellValue(tableData.lastNameField),
         }

         if (validEmail(unmatchedEmail))  { newMemberFields[membershipTableEmailFields.primary] = unmatchedEmail; }
         if (validPhone(unmatchedPhone)) { newMemberFields[membershipTablePhoneFields.primary] = unmatchedPhone; }

         matchId = await existingMembersTable.createRecordAsync(newMemberFields);

         // add the match to existingMembers so we don't create it twice 
         // @ts-ignore
         existingMembers.unshift(new PsuedoAirTableRecord({ 
             ...newMemberFields,
             id: matchId
         }));
         newRecords += 1;

     } else {
         // TODO: also update existing record's information?
         matchedRecords += 1;
     }
     
     // link the member record to the match from Member List
     await table.updateRecordAsync(unmatchedRecord.id, {
         [tableData.memberLinkField]: [{ id: matchId}]
     });
 }

 console.log(`matched ${matchedRecords} with existing records and created ${newRecords} new records. There were ${unmatchableRecords} unmatchable records\n\n`)
};