# Modifying Your Notion Database to Accept All JSON Properties

Instead of adapting your JSON to fit your Notion database, you can modify your Notion database to accept all the properties from your JSON. This guide will walk you through adding the missing properties to your Notion database.

## Missing Properties to Add

Based on the error message, these properties need to be added to your Notion database:

- `AI_Title` (or use the existing `Title` property)
- `AI_Cost`
- `Action_Items`
- `Duration_Seconds`
- `Follow-up_Questions`
- `Main_Points`

## Steps to Add Properties in Notion

1. **Open your Notion database** where you're trying to send the data.

2. **Click on the "..." menu** in the top-right corner of the database view.

3. **Select "Properties"** from the dropdown menu.

4. **Add each missing property** with the appropriate type:

   - **AI_Title**: If you already have a `Title` property, you can keep using that. Otherwise, add a new "Title" type property.
   
   - **AI_Cost**: Add a new "Text" type property named "AI_Cost".
   
   - **Action_Items**: Add a new "Multi-select" type property named "Action_Items".
   
   - **Duration_Seconds**: Add a new "Number" type property named "Duration_Seconds".
   
   - **Follow-up_Questions**: Add a new "Multi-select" type property named "Follow-up_Questions".
   
   - **Main_Points**: Add a new "Multi-select" type property named "Main_Points".

5. **Click "Done"** to save your changes.

## Property Types Reference

Here's a reference for choosing the appropriate property type for each field:

| Property | Recommended Notion Type | Notes |
|----------|-------------------------|-------|
| AI_Title | Title | If you already have a Title property, you can use that |
| AI_Cost | Text | For storing cost values like "$0.15" |
| Action_Items | Multi-select | For storing an array of action items |
| Duration_Seconds | Number | For storing the duration in seconds as a number |
| Follow-up_Questions | Multi-select | For storing an array of follow-up questions |
| Main_Points | Multi-select | For storing an array of main points |

## Alternative: Using Rich Text for Arrays

If you prefer to have the array items displayed as a formatted list rather than as tags:

1. Instead of using "Multi-select" for arrays, use "Rich Text" type properties.
2. Modify the `notion_adapter.js` script to format arrays as bulleted lists for these properties.

## Testing Your Changes

After adding the properties to your Notion database:

1. Try sending your original JSON data to Notion again.
2. If you still encounter errors, check the error message to see if there are any remaining properties that need to be added.

## Updating the Adapter Script (Optional)

If you've added all the properties to your Notion database, you can update the `notion_adapter.js` script to pass through all properties without filtering:

```javascript
// Replace the notionCompatibleData object with this:
const notionCompatibleData = {
  // Map AI_Title to Title if needed
  Title: inputData.AI_Title || inputData.Title || "",
  
  // Pass through all other properties
  Type: inputData.Type || "",
  Duration: inputData.Duration || "",
  Duration_Seconds: inputData.Duration_Seconds || 0,
  AI_Cost: inputData.AI_Cost || "",
  Icon: inputData.Icon || "",
  Summary: inputData.Summary || [],
  Main_Points: inputData.Main_Points || [],
  Action_Items: inputData.Action_Items || [],
  References: inputData.References || [],
  Follow_up_Questions: inputData.Follow_up_Questions || [],
  Stories: inputData.Stories || [],
  Arguments: inputData.Arguments || [],
  Sentiment: inputData.Sentiment || []
};
