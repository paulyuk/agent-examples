# Cosmos DB Identity-Based Authentication

This project now supports **keyless authentication** to Cosmos DB using Azure Active Directory (Azure AD) identity, which is the recommended approach for production deployments.

## Benefits of Identity-Based Authentication

✅ **No secrets in code or configuration files**  
✅ **Automatic credential rotation**  
✅ **Centralized access management through Azure AD**  
✅ **Audit trails and compliance**  
✅ **Follows Azure security best practices**  

## How It Works

The system uses Azure Identity's `DefaultAzureCredential` which automatically tries multiple authentication methods in order:

1. **Environment variables** (service principal)
2. **Managed Identity** (when running on Azure services)
3. **Azure CLI** (when developing locally)
4. **Azure PowerShell** (alternative local development)
5. **Interactive browser** (fallback for local development)

## Configuration

### Identity-Based (Recommended)
```javascript
const config = {
  azureOpenAI: { /* your OpenAI config */ },
  cosmos: {
    endpoint: 'https://your-cosmos-account.documents.azure.com:443/',
    databaseId: 'agent-conversations',
    containerId: 'sessions',
    useIdentity: true, // Use Azure AD identity
    // No 'key' property needed
  }
};
```


### Environment Variables
Set these in your shell or `.env` file. Defaults are shown below:
```bash
# Cosmos DB
export COSMOS_RESOURCE_GROUP=${COSMOS_RESOURCE_GROUP:-rg-agent-example}
export COSMOS_ACCOUNT=${COSMOS_ACCOUNT:-your-cosmos-account}
export COSMOS_ENDPOINT=${COSMOS_ENDPOINT:-https://$COSMOS_ACCOUNT.documents.azure.com:443/}
export COSMOS_DATABASE_ID=${COSMOS_DATABASE_ID:-agent-conversations}
export COSMOS_CONTAINER_ID=${COSMOS_CONTAINER_ID:-sessions}
export COSMOS_USE_IDENTITY=${COSMOS_USE_IDENTITY:-true}

# User/Principal
export USER_ID=${USER_ID:-$(az ad signed-in-user show --query id -o tsv)}
```

## Azure Setup Requirements

### 1. Create Cosmos DB Account
```bash
# Create resource group
az group create --name "$COSMOS_RESOURCE_GROUP" --location eastus

# Create Cosmos DB account
az cosmosdb create \
  --name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --kind GlobalDocumentDB
```

### 2. Create Database and Container
```bash
# Create database
az cosmosdb sql database create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --name "$COSMOS_DATABASE_ID"

# Create container
az cosmosdb sql container create \
  --account-name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --database-name "$COSMOS_DATABASE_ID" \
  --name "$COSMOS_CONTAINER_ID" \
  --partition-key-path "/sessionId"
```

### 3. Grant Access Rights

For your identity to access Cosmos DB, assign the **Cosmos DB Data Contributor** role:

```bash

# Get your user principal ID (if not already set)
export USER_ID=${USER_ID:-$(az ad signed-in-user show --query id -o tsv)}

# Get Cosmos DB resource ID (if needed)
export COSMOS_ID=${COSMOS_ID:-$(az cosmosdb show \
  --name "$COSMOS_ACCOUNT" \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --query id -o tsv)}

az role assignment create \
az cosmosdb sql role assignment create \
## Assign Cosmos DB Data Contributor Role (Recommended: Native RBAC via Bicep)

The most reliable and future-proof way to assign the Cosmos DB Built-in Data Contributor role is to use a Bicep deployment, following the official pattern:


1. **Create the Bicep file** (`cosmosdb-sql-rbac.bicep`):

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

2. **Deploy the Bicep file** (using your environment variables):

```sh
az deployment group create \
# Deploy the Bicep file using your environment variables
az deployment group create \
  --resource-group "$COSMOS_RESOURCE_GROUP" \
  --template-file cosmosdb-sql-rbac.bicep \
  --parameters cosmosAccountName="$COSMOS_ACCOUNT" principalId="$USER_ID"
```

This will assign the Cosmos DB Built-in Data Contributor role to the specified user or managed identity at the Cosmos DB account scope using the native Cosmos DB RBAC system.
```


### 4. For Production (Managed Identity)

When deploying to Azure services, use managed identity:

```bash
# Enable system-assigned managed identity on your App Service/Function/Container
az webapp identity assign --name your-app --resource-group your-rg

# Get the managed identity principal ID
PRINCIPAL_ID=$(az webapp identity show \
  --name your-app \
  --resource-group your-rg \
  --query principalId -o tsv)

# Assign Cosmos DB roles to the managed identity
az role assignment create \
  --role "Cosmos DB Account Reader Role" \
  --assignee $PRINCIPAL_ID \
  --scope $COSMOS_ID
```

## Local Development Setup

### Using Azure CLI (Recommended)
```bash
# Login to Azure CLI
az login

# Set your subscription
az account set --subscription "your-subscription-id"

# Test the connection
npm run test:cosmos-identity
```

## Testing

Run the identity authentication test:
```bash
npm run build
npm run test:cosmos-identity
```

## Troubleshooting

### Common Issues

1. **"Forbidden" errors**: Check that your identity has the correct Cosmos DB roles
2. **"Not found" errors**: Verify database and container names are correct
3. **Authentication failures**: Ensure you're logged into Azure CLI or have proper environment variables set

### Debug Authentication
```javascript
import { DefaultAzureCredential } from '@azure/identity';

// Enable logging to see which credential is being used
const credential = new DefaultAzureCredential({
  loggingOptions: { enableLogging: true }
});
```

## Migration from Key-Based Authentication

The system maintains backward compatibility. If you have existing key-based configuration, it will continue to work:

```javascript
// Legacy key-based (still supported)
cosmos: {
  endpoint: 'https://your-cosmos-account.documents.azure.com:443/',
  key: 'your-cosmos-key',
  databaseId: 'agent-conversations',
  containerId: 'sessions'
}

// New identity-based (recommended)
cosmos: {
  endpoint: 'https://your-cosmos-account.documents.azure.com:443/',
  databaseId: 'agent-conversations',
  containerId: 'sessions',
  useIdentity: true
}
```

To migrate, simply remove the `key` property and add `useIdentity: true`.
