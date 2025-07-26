# Prompt: Cosmos DB Identity-Based RBAC Setup

## Objective

Guide a developer to:
- Create a Cosmos DB account (if it does not exist)
- Set up a database and container
- Assign RBAC (Cosmos DB Built-in Data Contributor) to a user or managed identity using Bicep
- Test the database connection

## Prerequisites
- Azure CLI installed and logged in
- Bicep CLI installed (or use `az bicep install`)
- Sufficient Azure permissions to create resources and assign roles

## 1. Set Environment Variables
Set these in your shell or `.env` file. Defaults are shown below:

```bash
# Cosmos DB
export COSMOS_RESOURCE_GROUP=${COSMOS_RESOURCE_GROUP:-rg-cosmosdb-demo}
export COSMOS_ACCOUNT=${COSMOS_ACCOUNT:-my-cosmos-account}
export COSMOS_ENDPOINT=${COSMOS_ENDPOINT:-https://$COSMOS_ACCOUNT.documents.azure.com:443/}
export COSMOS_DATABASE_ID=${COSMOS_DATABASE_ID:-agent-conversations}
export COSMOS_CONTAINER_ID=${COSMOS_CONTAINER_ID:-sessions}
export COSMOS_USE_IDENTITY=${COSMOS_USE_IDENTITY:-true}

# User/Principal
export USER_ID=${USER_ID:-$(az ad signed-in-user show --query id -o tsv)}
```

## 2. Create Cosmos DB Account (if needed)
```bash
az group create --name "$COSMOS_RESOURCE_GROUP" --location eastus
az cosmosdb create \
  --name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --kind GlobalDocumentDB
```

## 3. Create Database and Container
```bash
az cosmosdb sql database create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --name "$COSMOS_DATABASE_ID"

az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --database-name "$COSMOS_DATABASE_ID" \
  --name "$COSMOS_CONTAINER_ID" \
  --partition-key-path "/sessionId"
```

## 4. Assign Cosmos DB Built-in Data Contributor Role (Native RBAC via Bicep)

1. **Create the Bicep file** (`infra/cosmosdb-sql-rbac.bicep`):

```bicep
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
```

2. **Deploy the Bicep file**:

```bash
az deployment group create \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --template-file infra/cosmosdb-sql-rbac.bicep \
  --parameters cosmosAccountName="$COSMOS_ACCOUNT" principalId="$USER_ID"
```

## 5. Test the Database Connection

You can use the following Node.js/TypeScript snippet to test identity-based access:

```typescript
import { CosmosClient } from "@azure/cosmos";
import { DefaultAzureCredential } from "@azure/identity";

const endpoint = process.env.COSMOS_ENDPOINT;
const databaseId = process.env.COSMOS_DATABASE_ID;
const containerId = process.env.COSMOS_CONTAINER_ID;

const credential = new DefaultAzureCredential();
const client = new CosmosClient({ endpoint, aadCredentials: credential });

async function test() {
  const { database } = await client.databases.createIfNotExists({ id: databaseId });
  const { container } = await database.containers.createIfNotExists({ id: containerId, partitionKey: "/sessionId" });
  const { resource: item } = await container.items.create({ sessionId: "test", message: "Hello Cosmos DB!" });
  console.log("Test item written:", item);
}

test().catch(console.error);
```

---

- This prompt ensures a developer can create a Cosmos DB account, set up RBAC, and verify access using identity-based authentication, all with reusable environment variables and scripts.
