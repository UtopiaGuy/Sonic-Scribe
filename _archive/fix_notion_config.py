#!/usr/bin/env python3
"""
Notion Configuration Fixer

This script helps you identify and fix Notion database configuration issues.
It can check if your Notion ID is valid and help you create a proper database.
"""

import requests
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

def get_notion_credentials():
    """Get Notion API credentials from environment variables."""
    api_key = os.getenv('NOTION_API_KEY')
    database_id = os.getenv('NOTION_DATABASE_ID')
    
    if not api_key:
        print("Error: NOTION_API_KEY not found in environment variables")
        return None, None
    
    if not database_id:
        print("Error: NOTION_DATABASE_ID not found in environment variables")
        return api_key, None
    
    return api_key, database_id

def check_notion_object(api_key, object_id):
    """
    Check if a Notion ID is a page or database.
    
    Args:
        api_key (str): Notion API key
        object_id (str): Notion object ID to check
    
    Returns:
        dict: Object information or error
    """
    # Clean the object ID (remove hyphens and format properly)
    clean_id = object_id.replace('-', '')
    formatted_id = f"{clean_id[:8]}-{clean_id[8:12]}-{clean_id[12:16]}-{clean_id[16:20]}-{clean_id[20:]}"
    
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }
    
    # Try to retrieve as a database first
    print(f"Checking ID: {formatted_id}")
    
    try:
        # Try database endpoint
        db_response = requests.get(
            f'https://api.notion.com/v1/databases/{formatted_id}',
            headers=headers
        )
        
        if db_response.status_code == 200:
            print("✅ This is a valid database!")
            return {"type": "database", "data": db_response.json()}
        
        # If not a database, try page endpoint
        page_response = requests.get(
            f'https://api.notion.com/v1/pages/{formatted_id}',
            headers=headers
        )
        
        if page_response.status_code == 200:
            print("ℹ️  This is a page, not a database.")
            page_data = page_response.json()
            
            # Check if this page contains a database
            if page_data.get('object') == 'page':
                print("You need to create a database or find an existing database ID.")
                return {"type": "page", "data": page_data}
        
        # If neither worked, check the error
        print("❌ Could not retrieve object. Response:")
        print(f"Database endpoint: {db_response.status_code} - {db_response.text}")
        print(f"Page endpoint: {page_response.status_code} - {page_response.text}")
        
        return {"type": "error", "message": "Could not retrieve object"}
        
    except Exception as e:
        print(f"❌ Error checking Notion object: {e}")
        return {"type": "error", "message": str(e)}

def create_voice_notes_database(api_key, parent_page_id=None):
    """
    Create a new Notion database for voice notes.
    
    Args:
        api_key (str): Notion API key
        parent_page_id (str): Parent page ID (optional)
    
    Returns:
        dict: Created database information
    """
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
    }
    
    # Database schema matching your C++ application
    database_schema = {
        "parent": {
            "type": "page_id",
            "page_id": parent_page_id
        } if parent_page_id else {
            "type": "workspace",
            "workspace": True
        },
        "title": [
            {
                "type": "text",
                "text": {
                    "content": "Voice Notes Database"
                }
            }
        ],
        "properties": {
            "Title": {
                "title": {}
            },
            "Type": {
                "select": {
                    "options": [
                        {"name": "AI Transcription", "color": "blue"},
                        {"name": "Meeting Notes", "color": "green"},
                        {"name": "Voice Memo", "color": "yellow"},
                        {"name": "Interview", "color": "red"},
                        {"name": "Lecture", "color": "purple"}
                    ]
                }
            },
            "Duration": {
                "rich_text": {}
            },
            "Duration (Seconds)": {
                "number": {}
            },
            "AI Cost": {
                "number": {
                    "format": "dollar"
                }
            },
            "Date": {
                "date": {}
            },
            "Icon": {
                "rich_text": {}
            },
            "Main Points": {
                "rich_text": {}
            },
            "Action Items": {
                "rich_text": {}
            },
            "References": {
                "rich_text": {}
            },
            "Follow-up Questions": {
                "rich_text": {}
            },
            "Stories": {
                "rich_text": {}
            },
            "Arguments": {
                "rich_text": {}
            },
            "Sentiment": {
                "rich_text": {}
            }
        }
    }
    
    try:
        response = requests.post(
            'https://api.notion.com/v1/databases',
            headers=headers,
            json=database_schema
        )
        
        if response.status_code == 200:
            database_data = response.json()
            database_id = database_data['id']
            print(f"✅ Successfully created database!")
            print(f"Database ID: {database_id}")
            print(f"Database URL: {database_data['url']}")
            return {"success": True, "database_id": database_id, "data": database_data}
        else:
            print(f"❌ Failed to create database: {response.status_code}")
            print(response.text)
            return {"success": False, "error": response.text}
            
    except Exception as e:
        print(f"❌ Error creating database: {e}")
        return {"success": False, "error": str(e)}

def update_env_file(new_database_id):
    """Update the .env file with the new database ID."""
    try:
        # Read current .env file
        with open('.env', 'r') as f:
            lines = f.readlines()
        
        # Update the database ID line
        updated_lines = []
        for line in lines:
            if line.startswith('NOTION_DATABASE_ID='):
                updated_lines.append(f'NOTION_DATABASE_ID="{new_database_id}"\n')
            else:
                updated_lines.append(line)
        
        # Write updated file
        with open('.env', 'w') as f:
            f.writelines(updated_lines)
        
        print(f"✅ Updated .env file with new database ID: {new_database_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating .env file: {e}")
        return False

def update_config_h(new_database_id):
    """Update the config.h file with the new database ID."""
    try:
        # Read current config.h file
        with open('config.h', 'r') as f:
            content = f.read()
        
        # Replace the database ID
        import re
        pattern = r'const std::string NOTION_DATABASE_ID = "[^"]*";'
        replacement = f'const std::string NOTION_DATABASE_ID = "{new_database_id}";'
        
        updated_content = re.sub(pattern, replacement, content)
        
        # Write updated file
        with open('config.h', 'w') as f:
            f.write(updated_content)
        
        print(f"✅ Updated config.h file with new database ID: {new_database_id}")
        return True
        
    except Exception as e:
        print(f"❌ Error updating config.h file: {e}")
        return False

def main():
    print("🔧 Notion Configuration Fixer")
    print("=" * 40)
    
    # Get credentials
    api_key, database_id = get_notion_credentials()
    
    if not api_key:
        print("Please set up your NOTION_API_KEY in the .env file")
        return
    
    if database_id:
        print(f"Checking current database ID: {database_id}")
        result = check_notion_object(api_key, database_id)
        
        if result["type"] == "database":
            print("✅ Your current database ID is valid!")
            print("No changes needed.")
            return
        elif result["type"] == "page":
            print("❌ Your current ID points to a page, not a database.")
            print("You need to either:")
            print("1. Create a new database")
            print("2. Find the correct database ID")
    
    # Offer to create a new database
    create_new = input("\nWould you like to create a new Voice Notes database? (y/n): ")
    
    if create_new.lower() == 'y':
        print("\nCreating new database...")
        # Use the existing page ID as the parent
        parent_page_id = database_id if result["type"] == "page" else None
        result_create = create_voice_notes_database(api_key, parent_page_id)
        
        if result_create["success"]:
            new_id = result_create["database_id"]
            print(f"\n✅ Database created successfully!")
            print(f"New Database ID: {new_id}")
            
            # Update configuration files
            update_env = input("Update .env file with new database ID? (y/n): ")
            if update_env.lower() == 'y':
                update_env_file(new_id)
            
            update_config = input("Update config.h file with new database ID? (y/n): ")
            if update_config.lower() == 'y':
                update_config_h(new_id)
            
            print("\n🎉 Configuration updated! You can now run your transcription tool.")
        else:
            print("❌ Failed to create database. Please check your API key and permissions.")
    else:
        print("\nTo fix manually:")
        print("1. Go to your Notion workspace")
        print("2. Create a new database or find an existing one")
        print("3. Copy the database ID from the URL")
        print("4. Update your .env and config.h files")

if __name__ == "__main__":
    main()
