"""
Contextual Chat Feature Tests
Tests for contextual chat channels linked to leads and deals
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"

@pytest.fixture(scope="module")
def auth_token():
    """Get authentication token for test user"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD
    })
    assert response.status_code == 200, f"Login failed: {response.text}"
    data = response.json()
    return data["token"]

@pytest.fixture(scope="module")
def headers(auth_token):
    """Headers with auth token"""
    return {"Authorization": f"Bearer {auth_token}", "Content-Type": "application/json"}

@pytest.fixture(scope="module")
def test_lead(headers):
    """Create a test lead for contextual chat testing"""
    lead_data = {
        "first_name": "TEST_John",
        "last_name": "ChatLead",
        "email": f"test_chat_lead_{uuid.uuid4().hex[:6]}@example.com",
        "company": "Test Company",
        "job_title": "Manager"
    }
    response = requests.post(f"{BASE_URL}/api/leads", json=lead_data, headers=headers)
    assert response.status_code == 200, f"Failed to create test lead: {response.text}"
    lead = response.json()
    yield lead
    # Cleanup - delete the lead
    requests.delete(f"{BASE_URL}/api/leads/{lead['lead_id']}", headers=headers)

@pytest.fixture(scope="module")
def test_deal(headers):
    """Create a test deal for contextual chat testing"""
    # First get user_id from auth/me
    me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
    user_id = me_response.json().get("user_id", "")
    
    deal_data = {
        "name": f"TEST_Deal_Chat_{uuid.uuid4().hex[:6]}",
        "value": 50000,
        "stage": "qualified",
        "probability": 50,
        "task_title": "Initial contact",
        "task_owner_id": user_id
    }
    response = requests.post(f"{BASE_URL}/api/deals", json=deal_data, headers=headers)
    assert response.status_code == 200, f"Failed to create test deal: {response.text}"
    deal = response.json()
    yield deal

class TestContextualChatEndpoint:
    """Tests for GET /api/chat/context/{type}/{id} endpoint"""
    
    def test_contextual_chat_requires_auth(self):
        """Test that contextual chat endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/chat/context/lead/fake_id")
        assert response.status_code == 401, f"Expected 401, got {response.status_code}"
        print("✓ Contextual chat requires authentication")
    
    def test_contextual_chat_invalid_type(self, headers):
        """Test that invalid context type returns 400"""
        response = requests.get(f"{BASE_URL}/api/chat/context/invalid/some_id", headers=headers)
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        assert "Invalid context type" in response.json().get("detail", "")
        print("✓ Invalid context type returns 400")
    
    def test_contextual_chat_nonexistent_lead(self, headers):
        """Test that non-existent lead returns 404"""
        response = requests.get(f"{BASE_URL}/api/chat/context/lead/nonexistent_lead_123", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent lead returns 404")
    
    def test_contextual_chat_nonexistent_deal(self, headers):
        """Test that non-existent deal returns 404"""
        response = requests.get(f"{BASE_URL}/api/chat/context/deal/nonexistent_deal_123", headers=headers)
        assert response.status_code == 404, f"Expected 404, got {response.status_code}"
        print("✓ Non-existent deal returns 404")


class TestLeadContextualChat:
    """Tests for lead contextual chat channels"""
    
    def test_create_lead_contextual_channel(self, headers, test_lead):
        """Test creating a contextual channel for a lead"""
        lead_id = test_lead["lead_id"]
        response = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify channel structure
        assert data["channel_id"] == f"lead_{lead_id}", f"Unexpected channel_id: {data.get('channel_id')}"
        assert data["channel_type"] == "lead", f"Expected channel_type 'lead', got {data.get('channel_type')}"
        assert data["related_id"] == lead_id, f"related_id mismatch"
        assert "entity" in data, "Missing entity field"
        assert data["entity"]["lead_id"] == lead_id, "Entity lead_id mismatch"
        print(f"✓ Created lead contextual channel: {data['channel_id']}")
    
    def test_get_existing_lead_channel(self, headers, test_lead):
        """Test getting an existing lead contextual channel returns the same channel"""
        lead_id = test_lead["lead_id"]
        
        # First request creates the channel
        response1 = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        channel1 = response1.json()
        
        # Second request should return the same channel
        response2 = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        channel2 = response2.json()
        
        assert channel1["channel_id"] == channel2["channel_id"], "Channel IDs should match"
        assert response2.status_code == 200
        print("✓ Getting existing lead channel returns same channel")
    
    def test_lead_channel_contains_entity_info(self, headers, test_lead):
        """Test that lead channel response contains lead entity info"""
        lead_id = test_lead["lead_id"]
        response = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        data = response.json()
        
        entity = data.get("entity", {})
        assert entity.get("first_name") == "TEST_John", f"Entity first_name mismatch: {entity.get('first_name')}"
        assert entity.get("last_name") == "ChatLead", f"Entity last_name mismatch: {entity.get('last_name')}"
        assert entity.get("company") == "Test Company", f"Entity company mismatch: {entity.get('company')}"
        print("✓ Lead channel contains correct entity info")


class TestDealContextualChat:
    """Tests for deal contextual chat channels"""
    
    def test_create_deal_contextual_channel(self, headers, test_deal):
        """Test creating a contextual channel for a deal"""
        deal_id = test_deal["deal_id"]
        response = requests.get(f"{BASE_URL}/api/chat/context/deal/{deal_id}", headers=headers)
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        
        # Verify channel structure
        assert data["channel_id"] == f"deal_{deal_id}", f"Unexpected channel_id: {data.get('channel_id')}"
        assert data["channel_type"] == "deal", f"Expected channel_type 'deal', got {data.get('channel_type')}"
        assert data["related_id"] == deal_id, f"related_id mismatch"
        assert "entity" in data, "Missing entity field"
        assert data["entity"]["deal_id"] == deal_id, "Entity deal_id mismatch"
        print(f"✓ Created deal contextual channel: {data['channel_id']}")
    
    def test_deal_channel_contains_entity_info(self, headers, test_deal):
        """Test that deal channel response contains deal entity info"""
        deal_id = test_deal["deal_id"]
        response = requests.get(f"{BASE_URL}/api/chat/context/deal/{deal_id}", headers=headers)
        data = response.json()
        
        entity = data.get("entity", {})
        assert "name" in entity, "Entity should have name"
        assert entity.get("value") == 50000, f"Entity value mismatch: {entity.get('value')}"
        assert entity.get("stage") == "qualified", f"Entity stage mismatch: {entity.get('stage')}"
        print("✓ Deal channel contains correct entity info")


class TestContextualChannelMessaging:
    """Tests for sending messages in contextual channels"""
    
    def test_send_message_to_lead_channel(self, headers, test_lead):
        """Test sending a message to a lead contextual channel"""
        lead_id = test_lead["lead_id"]
        
        # First get/create the channel
        channel_response = requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        channel = channel_response.json()
        channel_id = channel["channel_id"]
        
        # Send a message
        message_data = {"content": f"TEST_Message discussing lead {lead_id}"}
        response = requests.post(
            f"{BASE_URL}/api/chat/channels/{channel_id}/messages",
            json=message_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        message = response.json()
        assert message["content"] == message_data["content"]
        assert message["channel_id"] == channel_id
        print(f"✓ Sent message to lead channel: {message['message_id']}")
    
    def test_send_message_to_deal_channel(self, headers, test_deal):
        """Test sending a message to a deal contextual channel"""
        deal_id = test_deal["deal_id"]
        
        # First get/create the channel
        channel_response = requests.get(f"{BASE_URL}/api/chat/context/deal/{deal_id}", headers=headers)
        channel = channel_response.json()
        channel_id = channel["channel_id"]
        
        # Send a message
        message_data = {"content": f"TEST_Message discussing deal {deal_id}"}
        response = requests.post(
            f"{BASE_URL}/api/chat/channels/{channel_id}/messages",
            json=message_data,
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        message = response.json()
        assert message["content"] == message_data["content"]
        assert message["channel_id"] == channel_id
        print(f"✓ Sent message to deal channel: {message['message_id']}")
    
    def test_get_messages_from_contextual_channel(self, headers, test_lead):
        """Test retrieving messages from a contextual channel"""
        lead_id = test_lead["lead_id"]
        channel_id = f"lead_{lead_id}"
        
        # Get messages
        response = requests.get(
            f"{BASE_URL}/api/chat/channels/{channel_id}/messages",
            headers=headers
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "messages" in data, "Response should contain messages array"
        print(f"✓ Retrieved {len(data['messages'])} messages from lead channel")


class TestContextualChannelInChannelList:
    """Tests for contextual channels appearing in channel list"""
    
    def test_contextual_channel_appears_in_list(self, headers, test_lead):
        """Test that created contextual channel appears in channel list"""
        lead_id = test_lead["lead_id"]
        
        # Create the channel first
        requests.get(f"{BASE_URL}/api/chat/context/lead/{lead_id}", headers=headers)
        
        # Get all channels
        response = requests.get(f"{BASE_URL}/api/chat/channels", headers=headers)
        assert response.status_code == 200
        
        data = response.json()
        channels = data.get("channels", [])
        
        # Find the lead channel
        lead_channel = next(
            (c for c in channels if c.get("channel_id") == f"lead_{lead_id}"),
            None
        )
        assert lead_channel is not None, f"Lead channel not found in channel list. Channels: {[c['channel_id'] for c in channels]}"
        assert lead_channel["channel_type"] == "lead"
        print("✓ Contextual lead channel appears in channel list")
    
    def test_deal_contextual_channel_appears_in_list(self, headers, test_deal):
        """Test that deal contextual channel appears in channel list"""
        deal_id = test_deal["deal_id"]
        
        # Create the channel first
        requests.get(f"{BASE_URL}/api/chat/context/deal/{deal_id}", headers=headers)
        
        # Get all channels
        response = requests.get(f"{BASE_URL}/api/chat/channels", headers=headers)
        channels = response.json().get("channels", [])
        
        # Find the deal channel
        deal_channel = next(
            (c for c in channels if c.get("channel_id") == f"deal_{deal_id}"),
            None
        )
        assert deal_channel is not None, f"Deal channel not found in channel list"
        assert deal_channel["channel_type"] == "deal"
        print("✓ Contextual deal channel appears in channel list")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
