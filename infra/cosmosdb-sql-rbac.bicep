



param cosmosAccountName string
param principalId string
param cosmosDbDataContributorRoleDefinitionId string = '00000000-0000-0000-0000-000000000002' // Cosmos DB Data Contributor
var cosmosFQRoleID = '/subscriptions/${subscription().subscriptionId}/resourceGroups/${resourceGroup().name}/providers/Microsoft.DocumentDB/databaseAccounts/${cosmosAccountName}/sqlRoleDefinitions/${cosmosDbDataContributorRoleDefinitionId}'

resource cosmosAccount 'Microsoft.DocumentDB/databaseAccounts@2024-11-15' existing = {
  name: cosmosAccountName
}

resource sqlRoleAssignment 'Microsoft.DocumentDB/databaseAccounts/sqlRoleAssignments@2024-11-15' = {
  name: guid(cosmosDbDataContributorRoleDefinitionId, principalId, cosmosAccount.id)
  parent: cosmosAccount
  properties: {
    principalId: principalId
    roleDefinitionId: cosmosFQRoleID
    scope: cosmosAccount.id
  }
}
