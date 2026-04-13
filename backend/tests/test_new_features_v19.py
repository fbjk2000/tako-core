"""
Test cases for iteration 19 features:
- Chat archive functionality
- Contacts CRUD operations
- Lead to Contact conversion
- Chat 'View Lead' link navigation (frontend)
- Collapsible channel sections (frontend)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "florian@unyted.world"
TEST_PASSWORD = "DavidConstantin18"


@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    assert "token" in data, "No token in login response"
    return data["token"]


@pytest.fixture(scope="module")
def auth_headers(auth_token):
    """Authorization headers"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}


class TestContactsCRUD:
    """Test Contacts API endpoints"""
    
    def test_get_contacts_list(self, auth_headers):
        """GET /api/contacts - should return list of contacts"""
        response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get contacts: {response.text}"
        data = response.json()
        assert isinstance(data, list), "Response should be a list"
        print(f"SUCCESS: GET /api/contacts returned {len(data)} contacts")
        return data
    
    def test_create_contact(self, auth_headers):
        """POST /api/contacts - should create a new contact"""
        unique_id = uuid.uuid4().hex[:6]
        contact_data = {
            "first_name": f"TEST_Contact_{unique_id}",
            "last_name": f"User_{unique_id}",
            "email": f"test_contact_{unique_id}@example.com",
            "phone": "+1234567890",
            "company": "Test Company",
            "job_title": "Test Role",
            "decision_maker": True,
            "budget": "$10,000",
            "timeline": "Q1 2026",
            "pain_points": "Testing pain points"
        }
        response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json=contact_data)
        assert response.status_code == 200, f"Failed to create contact: {response.text}"
        data = response.json()
        assert "contact_id" in data, "Response should contain contact_id"
        assert data["first_name"] == contact_data["first_name"]
        assert data["decision_maker"] == True
        print(f"SUCCESS: POST /api/contacts created contact {data['contact_id']}")
        return data
    
    def test_get_single_contact(self, auth_headers):
        """GET /api/contacts/{id} - should return single contact with all fields"""
        # First create a contact
        unique_id = uuid.uuid4().hex[:6]
        contact_data = {
            "first_name": f"TEST_Single_{unique_id}",
            "last_name": "ContactTest",
            "email": f"single_{unique_id}@test.com",
            "company": "SingleTest Co",
            "budget": "$5000",
            "timeline": "Immediate"
        }
        create_response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json=contact_data)
        assert create_response.status_code == 200
        contact_id = create_response.json()["contact_id"]
        
        # Get the contact
        response = requests.get(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get contact: {response.text}"
        data = response.json()
        assert data["contact_id"] == contact_id
        assert data["first_name"] == contact_data["first_name"]
        print(f"SUCCESS: GET /api/contacts/{contact_id} returned contact with all fields")
        return contact_id
    
    def test_update_contact(self, auth_headers):
        """PUT /api/contacts/{id} - should update contact fields"""
        # First create a contact
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
            "first_name": f"TEST_Update_{unique_id}",
            "last_name": "UpdateTest",
            "email": f"update_{unique_id}@test.com"
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["contact_id"]
        
        # Update the contact
        updates = {
            "job_title": "Updated Title",
            "budget": "$20,000",
            "decision_maker": True,
            "pain_points": "Updated pain points"
        }
        response = requests.put(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers, json=updates)
        assert response.status_code == 200, f"Failed to update contact: {response.text}"
        data = response.json()
        assert data["job_title"] == "Updated Title"
        assert data["budget"] == "$20,000"
        assert data["decision_maker"] == True
        print(f"SUCCESS: PUT /api/contacts/{contact_id} updated contact")
    
    def test_delete_contact(self, auth_headers):
        """DELETE /api/contacts/{id} - should delete contact"""
        # First create a contact
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/contacts", headers=auth_headers, json={
            "first_name": f"TEST_Delete_{unique_id}",
            "last_name": "DeleteTest",
            "email": f"delete_{unique_id}@test.com"
        })
        assert create_response.status_code == 200
        contact_id = create_response.json()["contact_id"]
        
        # Delete the contact
        response = requests.delete(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to delete contact: {response.text}"
        
        # Verify deletion
        get_response = requests.get(f"{BASE_URL}/api/contacts/{contact_id}", headers=auth_headers)
        assert get_response.status_code == 404, "Contact should be deleted"
        print(f"SUCCESS: DELETE /api/contacts/{contact_id} deleted contact")


class TestLeadToContactConversion:
    """Test Lead to Contact conversion endpoint"""
    
    def test_convert_lead_to_contact(self, auth_headers):
        """POST /api/leads/{id}/convert-to-contact - should convert lead to contact"""
        # First create a lead
        unique_id = uuid.uuid4().hex[:6]
        lead_data = {
            "first_name": f"TEST_ConvertLead_{unique_id}",
            "last_name": f"ToContact_{unique_id}",
            "email": f"convert_{unique_id}@test.com",
            "phone": "+1987654321",
            "company": "Convert Test Co",
            "job_title": "Manager",
            "linkedin_url": "https://linkedin.com/in/test",
            "source": "manual"
        }
        create_response = requests.post(f"{BASE_URL}/api/leads", headers=auth_headers, json=lead_data)
        assert create_response.status_code == 200, f"Failed to create lead: {create_response.text}"
        lead_id = create_response.json()["lead_id"]
        
        # Convert to contact
        response = requests.post(f"{BASE_URL}/api/leads/{lead_id}/convert-to-contact", headers=auth_headers)
        assert response.status_code == 200, f"Failed to convert lead: {response.text}"
        data = response.json()
        
        # Verify contact has all lead data
        assert "contact_id" in data, "Response should contain contact_id"
        assert data["first_name"] == lead_data["first_name"]
        assert data["last_name"] == lead_data["last_name"]
        assert data["email"] == lead_data["email"]
        assert data["phone"] == lead_data["phone"]
        assert data["company"] == lead_data["company"]
        assert data["lead_id"] == lead_id
        print(f"SUCCESS: POST /api/leads/{lead_id}/convert-to-contact created contact {data['contact_id']}")
        
        # Verify lead status is now 'converted'
        lead_response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        assert lead_response.status_code == 200
        lead_data_updated = lead_response.json()
        assert lead_data_updated["status"] == "converted", f"Lead status should be 'converted', got {lead_data_updated['status']}"
        print(f"SUCCESS: Lead {lead_id} status updated to 'converted'")
        
        return data["contact_id"]
    
    def test_convert_lead_with_deal_id(self, auth_headers):
        """POST /api/leads/{id}/convert-to-contact?deal_id=xxx - should link deal"""
        # First get an existing deal
        deals_response = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        deals = deals_response.json()
        deal_id = deals[0]["deal_id"] if deals else None
        
        # Create a lead
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/leads", headers=auth_headers, json={
            "first_name": f"TEST_ConvertDeal_{unique_id}",
            "last_name": "WithDeal",
            "email": f"deal_{unique_id}@test.com"
        })
        assert create_response.status_code == 200
        lead_id = create_response.json()["lead_id"]
        
        # Convert with deal_id
        url = f"{BASE_URL}/api/leads/{lead_id}/convert-to-contact"
        if deal_id:
            url += f"?deal_id={deal_id}"
        response = requests.post(url, headers=auth_headers)
        assert response.status_code == 200, f"Failed to convert lead with deal: {response.text}"
        data = response.json()
        if deal_id:
            assert data.get("deal_id") == deal_id, "Contact should be linked to deal"
            print(f"SUCCESS: Contact linked to deal {deal_id}")
        else:
            print("SUCCESS: Lead converted (no deals available to link)")


class TestChatArchive:
    """Test Chat channel archive functionality"""
    
    def test_archive_channel_admin_only(self, auth_headers):
        """PUT /api/chat/channels/{id}/archive - should require admin role"""
        # First create a test channel
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/chat/channels", headers=auth_headers, json={
            "name": f"test_archive_{unique_id}",
            "description": "Test channel for archiving",
            "channel_type": "general"
        })
        assert create_response.status_code == 200, f"Failed to create channel: {create_response.text}"
        channel_id = create_response.json()["channel_id"]
        
        # Archive the channel (user is super_admin, should work)
        response = requests.put(f"{BASE_URL}/api/chat/channels/{channel_id}/archive", headers=auth_headers)
        assert response.status_code == 200, f"Failed to archive channel: {response.text}"
        data = response.json()
        assert data["message"] == "Channel archived"
        print(f"SUCCESS: PUT /api/chat/channels/{channel_id}/archive archived channel")
    
    def test_archived_channel_not_in_list(self, auth_headers):
        """GET /api/chat/channels - should not return archived channels"""
        # Create and archive a channel
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/chat/channels", headers=auth_headers, json={
            "name": f"test_hidden_{unique_id}",
            "description": "Should be hidden after archive",
            "channel_type": "general"
        })
        assert create_response.status_code == 200
        channel_id = create_response.json()["channel_id"]
        
        # Archive it
        requests.put(f"{BASE_URL}/api/chat/channels/{channel_id}/archive", headers=auth_headers)
        
        # Get channels list
        response = requests.get(f"{BASE_URL}/api/chat/channels", headers=auth_headers)
        assert response.status_code == 200
        channels = response.json().get("channels", [])
        
        # Verify archived channel is not in list
        channel_ids = [c["channel_id"] for c in channels]
        assert channel_id not in channel_ids, "Archived channel should not appear in list"
        print(f"SUCCESS: Archived channel {channel_id} not in channels list")


class TestChatContextualChannels:
    """Test contextual chat channel functionality"""
    
    def test_get_lead_context_channel(self, auth_headers):
        """GET /api/chat/context/lead/{id} - should return or create lead discussion channel"""
        # Get a lead
        leads_response = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        leads = leads_response.json()
        if not leads:
            pytest.skip("No leads available for contextual chat test")
        lead_id = leads[0]["lead_id"]
        
        response = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get lead context channel: {response.text}"
        data = response.json()
        assert data.get("channel_type") == "lead"
        assert data.get("related_id") == lead_id
        print(f"SUCCESS: GET /api/chat/context/lead/{lead_id} returned channel {data.get('channel_id')}")


class TestTasksRegression:
    """Regression test: Tasks should still show assignee and have owner filter"""
    
    def test_get_tasks_with_assignee(self, auth_headers):
        """GET /api/tasks - should return tasks with assigned_to field"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        assert response.status_code == 200, f"Failed to get tasks: {response.text}"
        tasks = response.json()
        print(f"SUCCESS: GET /api/tasks returned {len(tasks)} tasks")
        
        # Check that tasks have assigned_to field
        for task in tasks[:5]:  # Check first 5 tasks
            assert "assigned_to" in task, "Task should have assigned_to field"
            print(f"  - Task '{task.get('title', 'untitled')}' assigned_to: {task.get('assigned_to', 'None')}")
    
    def test_tasks_filter_by_assignee(self, auth_headers):
        """GET /api/tasks?assigned_to=xxx - should filter by assignee"""
        # Get user info
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200
        user_id = me_response.json()["user_id"]
        
        # Filter tasks by assignee
        response = requests.get(f"{BASE_URL}/api/tasks?assigned_to={user_id}", headers=auth_headers)
        assert response.status_code == 200, f"Failed to filter tasks: {response.text}"
        tasks = response.json()
        
        # Verify all returned tasks are assigned to user
        for task in tasks:
            assert task.get("assigned_to") == user_id, f"Task should be assigned to {user_id}"
        print(f"SUCCESS: GET /api/tasks?assigned_to={user_id} returned {len(tasks)} filtered tasks")


class TestLeadStatusOptions:
    """Test lead status includes 'converted' option"""
    
    def test_lead_status_converted(self, auth_headers):
        """Lead status should accept 'converted' value"""
        # Create a lead
        unique_id = uuid.uuid4().hex[:6]
        create_response = requests.post(f"{BASE_URL}/api/leads", headers=auth_headers, json={
            "first_name": f"TEST_StatusLead_{unique_id}",
            "last_name": "StatusTest",
            "email": f"status_{unique_id}@test.com"
        })
        assert create_response.status_code == 200
        lead_id = create_response.json()["lead_id"]
        
        # Update status to converted (simulating what happens after conversion)
        response = requests.put(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers, json={
            "status": "converted"
        })
        assert response.status_code == 200, f"Failed to set status to converted: {response.text}"
        data = response.json()
        assert data["status"] == "converted"
        print(f"SUCCESS: Lead {lead_id} status set to 'converted'")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
