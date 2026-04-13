"""
Test cases for Team Chat feature
- Chat channels: Get, create
- Chat messages: Send, edit, delete, reactions
- Polling for new messages
- Notifications for mentions
"""

import pytest
import requests
import os
import uuid
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"


class TestChatFeatures:
    """Test suite for Team Chat feature"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login to get token
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.user_id = login_data.get("user_id")
        self.user_name = login_data.get("name")
        self.org_id = login_data.get("organization_id")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        print(f"Logged in as {login_data.get('name')} (user_id: {self.user_id})")
        yield
    
    # ==================== CHANNEL TESTS ====================
    
    def test_get_channels_requires_auth(self):
        """Test that getting channels requires authentication"""
        session = requests.Session()
        response = session.get(f"{BASE_URL}/api/chat/channels")
        assert response.status_code == 401, "Should require authentication"
        print("✓ Get channels requires authentication")
    
    def test_get_channels_returns_general_channel(self):
        """Test that General channel is auto-created for organization"""
        response = self.session.get(f"{BASE_URL}/api/chat/channels")
        assert response.status_code == 200, f"Failed to get channels: {response.text}"
        
        data = response.json()
        assert "channels" in data, "Response should contain 'channels' key"
        
        channels = data["channels"]
        general_channel = next((c for c in channels if c["channel_id"] == "general"), None)
        
        assert general_channel is not None, "General channel should exist"
        assert general_channel["name"] == "General", "General channel name should be 'General'"
        print(f"✓ General channel exists with {len(channels)} total channels")
    
    def test_create_new_channel(self):
        """Test creating a new chat channel"""
        unique_name = f"TEST_channel_{uuid.uuid4().hex[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/chat/channels",
            json={
                "name": unique_name,
                "description": "Test channel description",
                "channel_type": "general"
            }
        )
        assert response.status_code == 200, f"Failed to create channel: {response.text}"
        
        data = response.json()
        assert data["name"] == unique_name, "Channel name should match"
        assert data["description"] == "Test channel description", "Description should match"
        assert "channel_id" in data, "Channel should have an ID"
        
        self.created_channel_id = data["channel_id"]
        print(f"✓ Created new channel: {unique_name} (ID: {self.created_channel_id})")
        
        # Verify channel appears in list
        list_response = self.session.get(f"{BASE_URL}/api/chat/channels")
        assert list_response.status_code == 200
        channels = list_response.json()["channels"]
        created_channel = next((c for c in channels if c["channel_id"] == self.created_channel_id), None)
        assert created_channel is not None, "Created channel should appear in list"
        print("✓ Created channel appears in channel list")
    
    # ==================== MESSAGE TESTS ====================
    
    def test_send_message_to_channel(self):
        """Test sending a message to the general channel"""
        message_content = f"TEST_message_{uuid.uuid4().hex[:8]}"
        
        response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={
                "content": message_content,
                "channel_id": "general"
            }
        )
        assert response.status_code == 200, f"Failed to send message: {response.text}"
        
        data = response.json()
        assert data["content"] == message_content, "Message content should match"
        assert data["sender_id"] == self.user_id, "Sender ID should match current user"
        assert data["sender_name"] == self.user_name, "Sender name should match"
        assert "message_id" in data, "Message should have an ID"
        assert data["reactions"] == {}, "New message should have empty reactions"
        assert data["is_edited"] == False, "New message should not be edited"
        
        self.test_message_id = data["message_id"]
        print(f"✓ Sent message: {message_content}")
        return self.test_message_id
    
    def test_get_channel_messages(self):
        """Test retrieving messages from a channel"""
        response = self.session.get(f"{BASE_URL}/api/chat/channels/general/messages?limit=50")
        assert response.status_code == 200, f"Failed to get messages: {response.text}"
        
        data = response.json()
        assert "messages" in data, "Response should contain 'messages' key"
        
        messages = data["messages"]
        print(f"✓ Retrieved {len(messages)} messages from General channel")
        
        # Verify message structure
        if messages:
            msg = messages[0]
            assert "message_id" in msg, "Message should have ID"
            assert "content" in msg, "Message should have content"
            assert "sender_id" in msg, "Message should have sender_id"
            assert "sender_name" in msg, "Message should have sender_name"
            assert "created_at" in msg, "Message should have timestamp"
            print("✓ Message structure is correct")
    
    def test_edit_own_message(self):
        """Test editing own message"""
        # First send a message
        original_content = f"TEST_original_{uuid.uuid4().hex[:8]}"
        send_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": original_content, "channel_id": "general"}
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["message_id"]
        
        # Edit the message
        edited_content = f"TEST_edited_{uuid.uuid4().hex[:8]}"
        edit_response = self.session.put(
            f"{BASE_URL}/api/chat/messages/{message_id}?content={edited_content}"
        )
        assert edit_response.status_code == 200, f"Failed to edit message: {edit_response.text}"
        print(f"✓ Edited message from '{original_content}' to '{edited_content}'")
    
    def test_delete_own_message(self):
        """Test deleting own message"""
        # First send a message
        content = f"TEST_delete_me_{uuid.uuid4().hex[:8]}"
        send_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": content, "channel_id": "general"}
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["message_id"]
        
        # Delete the message
        delete_response = self.session.delete(f"{BASE_URL}/api/chat/messages/{message_id}")
        assert delete_response.status_code == 200, f"Failed to delete message: {delete_response.text}"
        print(f"✓ Deleted message: {message_id}")
        
        # Verify it's deleted (should not appear in messages)
        messages_response = self.session.get(f"{BASE_URL}/api/chat/channels/general/messages?limit=100")
        messages = messages_response.json().get("messages", [])
        deleted_msg = next((m for m in messages if m["message_id"] == message_id), None)
        assert deleted_msg is None, "Deleted message should not appear in list"
        print("✓ Deleted message no longer appears in channel")
    
    # ==================== REACTION TESTS ====================
    
    def test_add_reaction_to_message(self):
        """Test adding emoji reaction to a message"""
        # First send a message
        content = f"TEST_react_me_{uuid.uuid4().hex[:8]}"
        send_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": content, "channel_id": "general"}
        )
        assert send_response.status_code == 200
        message_id = send_response.json()["message_id"]
        
        # Add reaction
        emoji = "👍"
        reaction_response = self.session.post(
            f"{BASE_URL}/api/chat/messages/{message_id}/reactions?emoji={emoji}"
        )
        assert reaction_response.status_code == 200, f"Failed to add reaction: {reaction_response.text}"
        
        data = reaction_response.json()
        assert "reactions" in data, "Response should contain reactions"
        assert emoji in data["reactions"], f"Reaction {emoji} should be in response"
        assert self.user_id in data["reactions"][emoji], "User ID should be in reaction list"
        print(f"✓ Added reaction {emoji} to message")
        
        return message_id
    
    def test_toggle_reaction_off(self):
        """Test removing reaction (toggle off)"""
        # First send a message and add reaction
        content = f"TEST_toggle_react_{uuid.uuid4().hex[:8]}"
        send_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": content, "channel_id": "general"}
        )
        message_id = send_response.json()["message_id"]
        
        emoji = "❤️"
        # Add reaction
        self.session.post(f"{BASE_URL}/api/chat/messages/{message_id}/reactions?emoji={emoji}")
        
        # Toggle off (same endpoint removes it)
        toggle_response = self.session.post(
            f"{BASE_URL}/api/chat/messages/{message_id}/reactions?emoji={emoji}"
        )
        assert toggle_response.status_code == 200
        
        data = toggle_response.json()
        # Either emoji not in reactions or user not in list
        if emoji in data.get("reactions", {}):
            assert self.user_id not in data["reactions"][emoji], "User should be removed from reaction"
        print(f"✓ Toggled reaction {emoji} off successfully")
    
    # ==================== MENTION & REPLY TESTS ====================
    
    def test_send_message_with_reply(self):
        """Test sending a reply to another message"""
        # First send original message
        original_content = f"TEST_original_{uuid.uuid4().hex[:8]}"
        original_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": original_content, "channel_id": "general"}
        )
        original_id = original_response.json()["message_id"]
        
        # Send reply
        reply_content = f"TEST_reply_{uuid.uuid4().hex[:8]}"
        reply_response = self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={
                "content": reply_content,
                "channel_id": "general",
                "reply_to": original_id
            }
        )
        assert reply_response.status_code == 200, f"Failed to send reply: {reply_response.text}"
        
        data = reply_response.json()
        assert data["reply_to"] == original_id, "Reply should reference original message"
        print(f"✓ Sent reply to message {original_id}")
    
    def test_send_message_with_mention(self):
        """Test sending a message with @mention"""
        # Get organization members for mention
        members_response = self.session.get(f"{BASE_URL}/api/organizations/{self.org_id}/members")
        if members_response.status_code == 200:
            members = members_response.json()
            if members and len(members) > 0:
                mentioned_user = members[0]
                mentioned_id = mentioned_user.get("user_id")
                mentioned_name = mentioned_user.get("name", "User")
                
                # Send message with mention format @[name](user_id)
                mention_content = f"TEST_mention Hey @[{mentioned_name}]({mentioned_id}) check this out!"
                mention_response = self.session.post(
                    f"{BASE_URL}/api/chat/channels/general/messages",
                    json={
                        "content": mention_content,
                        "channel_id": "general",
                        "mentions": [mentioned_id]
                    }
                )
                assert mention_response.status_code == 200, f"Failed to send mention: {mention_response.text}"
                
                data = mention_response.json()
                assert mentioned_id in data.get("mentions", []), "Mentioned user should be in mentions list"
                print(f"✓ Sent message mentioning @{mentioned_name}")
                return
        
        print("⚠ Skipping mention test - no members available")
    
    # ==================== POLLING TESTS ====================
    
    def test_poll_for_new_messages(self):
        """Test polling endpoint for new messages"""
        # Get a timestamp to poll from
        since = datetime.utcnow().isoformat() + "Z"
        
        # Send a new message after the timestamp
        content = f"TEST_poll_message_{uuid.uuid4().hex[:8]}"
        self.session.post(
            f"{BASE_URL}/api/chat/channels/general/messages",
            json={"content": content, "channel_id": "general"}
        )
        
        # Poll for new messages
        poll_response = self.session.get(
            f"{BASE_URL}/api/chat/messages/new",
            params={"since": since, "channel_id": "general"}
        )
        assert poll_response.status_code == 200, f"Failed to poll messages: {poll_response.text}"
        
        data = poll_response.json()
        assert "messages" in data, "Response should contain messages"
        print(f"✓ Polled for new messages - found {len(data['messages'])} new messages")
    
    # ==================== NOTIFICATION TESTS ====================
    
    def test_get_notifications(self):
        """Test getting notifications for the user"""
        response = self.session.get(f"{BASE_URL}/api/notifications")
        assert response.status_code == 200, f"Failed to get notifications: {response.text}"
        
        data = response.json()
        assert "notifications" in data, "Response should contain notifications"
        assert "unread_count" in data, "Response should contain unread_count"
        print(f"✓ Got notifications - {data['unread_count']} unread")
    
    def test_mark_notification_read(self):
        """Test marking a notification as read"""
        # First get notifications
        notif_response = self.session.get(f"{BASE_URL}/api/notifications")
        notifications = notif_response.json().get("notifications", [])
        
        if notifications:
            notif_id = notifications[0].get("notification_id")
            mark_response = self.session.put(f"{BASE_URL}/api/notifications/{notif_id}/read")
            assert mark_response.status_code == 200, f"Failed to mark notification read: {mark_response.text}"
            print(f"✓ Marked notification {notif_id} as read")
        else:
            print("⚠ No notifications to mark as read")
    
    def test_mark_all_notifications_read(self):
        """Test marking all notifications as read"""
        response = self.session.put(f"{BASE_URL}/api/notifications/read-all")
        assert response.status_code == 200, f"Failed to mark all notifications read: {response.text}"
        print("✓ Marked all notifications as read")


class TestChatErrorHandling:
    """Test error handling for chat endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test session and login"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login
        login_response = self.session.post(
            f"{BASE_URL}/api/auth/login",
            json={"email": TEST_EMAIL, "password": TEST_PASSWORD}
        )
        assert login_response.status_code == 200
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.user_id = login_data.get("user_id")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        yield
    
    def test_edit_nonexistent_message(self):
        """Test editing a message that doesn't exist"""
        response = self.session.put(
            f"{BASE_URL}/api/chat/messages/nonexistent_msg?content=test"
        )
        assert response.status_code == 404, "Should return 404 for nonexistent message"
        print("✓ Edit nonexistent message returns 404")
    
    def test_delete_nonexistent_message(self):
        """Test deleting a message that doesn't exist"""
        response = self.session.delete(f"{BASE_URL}/api/chat/messages/nonexistent_msg")
        assert response.status_code == 404, "Should return 404 for nonexistent message"
        print("✓ Delete nonexistent message returns 404")
    
    def test_react_to_nonexistent_message(self):
        """Test reacting to a message that doesn't exist"""
        response = self.session.post(
            f"{BASE_URL}/api/chat/messages/nonexistent_msg/reactions?emoji=👍"
        )
        assert response.status_code == 404, "Should return 404 for nonexistent message"
        print("✓ React to nonexistent message returns 404")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
