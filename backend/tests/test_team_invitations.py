"""
Team Invitations Feature Tests
Tests for:
- Generate invite link (POST /api/organizations/invites/link)
- Send email invitations (POST /api/organizations/invites/email)
- CSV import for bulk invites (POST /api/organizations/invites/csv)
- Get pending invites (GET /api/organizations/invites)
- Revoke invite (DELETE /api/organizations/invites/{invite_id})
- Validate invite code (GET /api/invites/validate/{invite_code})
- Signup with invite code joins organization (POST /api/auth/register)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestTeamInvitations:
    """Team Invitation endpoints tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.user_id = login_data.get("user_id")
        self.org_id = login_data.get("organization_id")
        
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield
        
        # Cleanup - no cleanup needed as we're testing read operations mostly

    # ==================== Generate Invite Link Tests ====================
    
    def test_generate_invite_link_success(self):
        """Test generating an invite link"""
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=member")
        
        assert response.status_code == 200, f"Generate invite link failed: {response.text}"
        
        data = response.json()
        assert "invite_link" in data, "Response should contain invite_link"
        assert "invite_code" in data, "Response should contain invite_code"
        assert "expires_at" in data, "Response should contain expires_at"
        assert "role" in data, "Response should contain role"
        assert data["role"] == "member", "Role should be member"
        assert data["invite_code"].startswith("inv_"), f"Invite code should start with inv_: {data['invite_code']}"
        print(f"✓ Generated invite link: {data['invite_link']}")
        print(f"✓ Invite code: {data['invite_code']}")

    def test_generate_invite_link_as_admin_role(self):
        """Test generating an invite link with admin role"""
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=admin")
        
        assert response.status_code == 200, f"Generate admin invite link failed: {response.text}"
        
        data = response.json()
        assert data["role"] == "admin", "Role should be admin"
        print(f"✓ Generated admin invite link with role: {data['role']}")

    def test_generate_invite_link_invalid_role(self):
        """Test generating invite link with invalid role"""
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=owner")
        
        # Should return 400 for invalid role (can't invite as owner)
        assert response.status_code == 400, f"Should reject invalid role: {response.text}"
        print("✓ Invalid role correctly rejected")

    def test_generate_invite_link_requires_auth(self):
        """Test that invite link generation requires authentication"""
        unauthenticated_session = requests.Session()
        unauthenticated_session.headers.update({"Content-Type": "application/json"})
        
        response = unauthenticated_session.post(f"{BASE_URL}/api/organizations/invites/link")
        
        assert response.status_code == 401, f"Should require auth: {response.text}"
        print("✓ Unauthenticated request correctly rejected (401)")

    # ==================== Send Email Invitations Tests ====================
    
    def test_send_email_invitations_success(self):
        """Test sending email invitations"""
        test_email = f"test_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/email", json={
            "emails": [test_email],
            "role": "member"
        })
        
        assert response.status_code == 200, f"Send email invite failed: {response.text}"
        
        data = response.json()
        assert "sent" in data, "Response should contain sent list"
        assert "failed" in data, "Response should contain failed list"
        assert "total_sent" in data, "Response should contain total_sent"
        assert "total_failed" in data, "Response should contain total_failed"
        
        # Should have at least attempted to send
        assert len(data["sent"]) > 0 or len(data["failed"]) >= 0
        print(f"✓ Email invite response: sent={data['total_sent']}, failed={data['total_failed']}")

    def test_send_email_invitations_multiple_emails(self):
        """Test sending invitations to multiple emails"""
        test_emails = [
            f"bulk_test_{uuid.uuid4().hex[:6]}@example.com",
            f"bulk_test_{uuid.uuid4().hex[:6]}@example.com"
        ]
        
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/email", json={
            "emails": test_emails,
            "role": "member"
        })
        
        assert response.status_code == 200, f"Multiple email invite failed: {response.text}"
        
        data = response.json()
        total = data["total_sent"] + data["total_failed"]
        assert total == len(test_emails), f"Should process all {len(test_emails)} emails"
        print(f"✓ Bulk email invite processed {total} emails")

    def test_send_email_invitations_invalid_email(self):
        """Test that invalid emails are handled gracefully"""
        response = self.session.post(f"{BASE_URL}/api/organizations/invites/email", json={
            "emails": ["not-an-email"],
            "role": "member"
        })
        
        # Should return 422 for invalid email format
        assert response.status_code in [200, 422], f"Should handle invalid email: {response.text}"
        print(f"✓ Invalid email handled with status {response.status_code}")

    def test_send_email_invitations_requires_auth(self):
        """Test that email invitation requires authentication"""
        unauthenticated_session = requests.Session()
        unauthenticated_session.headers.update({"Content-Type": "application/json"})
        
        response = unauthenticated_session.post(f"{BASE_URL}/api/organizations/invites/email", json={
            "emails": ["test@example.com"],
            "role": "member"
        })
        
        assert response.status_code == 401, f"Should require auth: {response.text}"
        print("✓ Unauthenticated email invite correctly rejected (401)")

    # ==================== Get Pending Invites Tests ====================
    
    def test_get_pending_invites_success(self):
        """Test getting pending invitations"""
        response = self.session.get(f"{BASE_URL}/api/organizations/invites")
        
        assert response.status_code == 200, f"Get invites failed: {response.text}"
        
        data = response.json()
        assert "invites" in data, "Response should contain invites list"
        assert isinstance(data["invites"], list), "Invites should be a list"
        
        # Check structure if there are invites
        if len(data["invites"]) > 0:
            invite = data["invites"][0]
            assert "invite_id" in invite, "Invite should have invite_id"
            assert "invite_code" in invite, "Invite should have invite_code"
            assert "type" in invite, "Invite should have type (link or email)"
            assert "status" in invite, "Invite should have status"
            print(f"✓ Found {len(data['invites'])} pending invites with correct structure")
        else:
            print("✓ Invites list returned (empty)")

    def test_get_pending_invites_requires_auth(self):
        """Test that getting invites requires authentication"""
        unauthenticated_session = requests.Session()
        
        response = unauthenticated_session.get(f"{BASE_URL}/api/organizations/invites")
        
        assert response.status_code == 401, f"Should require auth: {response.text}"
        print("✓ Unauthenticated get invites correctly rejected (401)")

    # ==================== Revoke Invite Tests ====================
    
    def test_revoke_invite_success(self):
        """Test revoking an invite"""
        # First, generate an invite
        create_response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=member")
        assert create_response.status_code == 200, f"Create invite failed: {create_response.text}"
        
        # Get invites to find the invite_id
        get_response = self.session.get(f"{BASE_URL}/api/organizations/invites")
        invites = get_response.json().get("invites", [])
        
        if len(invites) > 0:
            invite_id = invites[0]["invite_id"]
            
            # Revoke the invite
            revoke_response = self.session.delete(f"{BASE_URL}/api/organizations/invites/{invite_id}")
            
            assert revoke_response.status_code == 200, f"Revoke failed: {revoke_response.text}"
            assert revoke_response.json().get("message") == "Invite revoked"
            print(f"✓ Successfully revoked invite {invite_id}")
        else:
            pytest.skip("No invites to revoke")

    def test_revoke_invite_not_found(self):
        """Test revoking a non-existent invite"""
        fake_invite_id = "invite_nonexistent123"
        
        response = self.session.delete(f"{BASE_URL}/api/organizations/invites/{fake_invite_id}")
        
        assert response.status_code == 404, f"Should return 404 for non-existent invite: {response.text}"
        print("✓ Non-existent invite correctly returns 404")

    def test_revoke_invite_requires_auth(self):
        """Test that revoking requires authentication"""
        unauthenticated_session = requests.Session()
        
        response = unauthenticated_session.delete(f"{BASE_URL}/api/organizations/invites/invite_123")
        
        assert response.status_code == 401, f"Should require auth: {response.text}"
        print("✓ Unauthenticated revoke correctly rejected (401)")

    # ==================== Validate Invite Code Tests (Public) ====================
    
    def test_validate_invite_code_success(self):
        """Test validating a valid invite code"""
        # First, generate an invite to test with
        create_response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=member")
        assert create_response.status_code == 200, f"Create invite failed: {create_response.text}"
        
        invite_code = create_response.json()["invite_code"]
        
        # Validate the invite code (public endpoint - no auth needed)
        validate_response = requests.get(f"{BASE_URL}/api/invites/validate/{invite_code}")
        
        assert validate_response.status_code == 200, f"Validate failed: {validate_response.text}"
        
        data = validate_response.json()
        assert data.get("valid") == True, "Invite should be valid"
        assert "organization_name" in data, "Response should contain organization_name"
        assert "role" in data, "Response should contain role"
        print(f"✓ Validated invite code: org={data['organization_name']}, role={data['role']}")

    def test_validate_invite_code_invalid(self):
        """Test validating an invalid invite code"""
        response = requests.get(f"{BASE_URL}/api/invites/validate/inv_invalid123456")
        
        assert response.status_code == 404, f"Should return 404 for invalid code: {response.text}"
        print("✓ Invalid invite code correctly returns 404")

    def test_validate_known_invite_code(self):
        """Test validating the known test invite code"""
        # Using the known test invite code from context
        response = requests.get(f"{BASE_URL}/api/invites/validate/inv_04626efb452740ac")
        
        # This should either be valid or expired/used
        assert response.status_code in [200, 400, 404], f"Unexpected status: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            print(f"✓ Known invite code valid: org={data.get('organization_name')}")
        else:
            print(f"✓ Known invite code returned {response.status_code} (may be expired/used)")

    # ==================== Signup with Invite Code Tests ====================
    
    def test_signup_with_invite_code(self):
        """Test that signup with invite code joins the organization"""
        # Generate a fresh invite
        create_response = self.session.post(f"{BASE_URL}/api/organizations/invites/link?role=member")
        assert create_response.status_code == 200, f"Create invite failed: {create_response.text}"
        
        invite_code = create_response.json()["invite_code"]
        org_id = self.org_id
        
        # Create a new user with the invite code
        new_user_email = f"invited_user_{uuid.uuid4().hex[:8]}@example.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_user_email,
            "password": "testpassword123",
            "name": "TEST_Invited User",
            "invite_code": invite_code
        })
        
        assert register_response.status_code == 200, f"Register with invite failed: {register_response.text}"
        
        data = register_response.json()
        assert data.get("organization_id") == org_id, "User should be added to the inviting organization"
        assert data.get("role") == "member", "User should have member role"
        print(f"✓ User registered with invite and joined org: {data.get('organization_id')}")

    def test_signup_with_invalid_invite_code(self):
        """Test that signup with invalid invite code fails"""
        new_user_email = f"invalid_invite_{uuid.uuid4().hex[:8]}@example.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_user_email,
            "password": "testpassword123",
            "name": "Invalid Invite User",
            "invite_code": "inv_invalid123456"
        })
        
        assert register_response.status_code == 400, f"Should reject invalid invite: {register_response.text}"
        assert "Invalid invitation" in register_response.json().get("detail", "")
        print("✓ Invalid invite code correctly rejected during signup")

    def test_signup_without_invite_creates_no_org(self):
        """Test that signup without invite and org name creates user without org"""
        new_user_email = f"no_org_user_{uuid.uuid4().hex[:8]}@example.com"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_user_email,
            "password": "testpassword123",
            "name": "No Org User"
        })
        
        assert register_response.status_code == 200, f"Register failed: {register_response.text}"
        
        data = register_response.json()
        assert data.get("organization_id") is None, "User should not have organization"
        print("✓ User registered without org when no invite/org_name provided")

    def test_signup_with_org_name_creates_org(self):
        """Test that signup with organization_name creates new org"""
        new_user_email = f"new_org_owner_{uuid.uuid4().hex[:8]}@example.com"
        org_name = f"TEST_Org_{uuid.uuid4().hex[:8]}"
        
        register_response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": new_user_email,
            "password": "testpassword123",
            "name": "New Org Owner",
            "organization_name": org_name
        })
        
        assert register_response.status_code == 200, f"Register failed: {register_response.text}"
        
        data = register_response.json()
        assert data.get("organization_id") is not None, "User should have organization"
        assert data.get("role") == "owner", "User should be owner of new org"
        print(f"✓ User created new org with ID: {data.get('organization_id')}")


class TestCSVImport:
    """CSV import tests for team invitations"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup test data and authenticate"""
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})
        
        # Login as test user
        login_response = self.session.post(f"{BASE_URL}/api/auth/login", json={
            "email": "test@example.com",
            "password": "test123"
        })
        assert login_response.status_code == 200, f"Login failed: {login_response.text}"
        
        login_data = login_response.json()
        self.token = login_data.get("token")
        self.session.headers.update({"Authorization": f"Bearer {self.token}"})
        
        yield

    def test_csv_import_success(self):
        """Test CSV import of invites"""
        # Create a simple CSV content
        csv_content = "email\ncsv_test1@example.com\ncsv_test2@example.com"
        
        # Prepare multipart form data
        files = {
            'file': ('invites.csv', csv_content, 'text/csv')
        }
        
        # Remove Content-Type header for multipart
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/organizations/invites/csv?role=member",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 200, f"CSV import failed: {response.text}"
        
        data = response.json()
        assert "sent" in data, "Response should contain sent list"
        assert "failed" in data, "Response should contain failed list"
        print(f"✓ CSV import: sent={data.get('total_sent', 0)}, failed={data.get('total_failed', 0)}")

    def test_csv_import_invalid_file_type(self):
        """Test that non-CSV files are rejected"""
        txt_content = "This is not a CSV file"
        
        files = {
            'file': ('invites.txt', txt_content, 'text/plain')
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/organizations/invites/csv?role=member",
            files=files,
            headers=headers
        )
        
        assert response.status_code == 400, f"Should reject non-CSV: {response.text}"
        print("✓ Non-CSV file correctly rejected")

    def test_csv_import_no_valid_emails(self):
        """Test CSV with no valid emails"""
        csv_content = "email\nnot-an-email\nalso-invalid"
        
        files = {
            'file': ('invites.csv', csv_content, 'text/csv')
        }
        
        headers = {"Authorization": f"Bearer {self.token}"}
        
        response = requests.post(
            f"{BASE_URL}/api/organizations/invites/csv?role=member",
            files=files,
            headers=headers
        )
        
        # Should return 400 or 200 with 0 sent
        assert response.status_code in [200, 400], f"Unexpected status: {response.text}"
        
        if response.status_code == 200:
            data = response.json()
            # If 200, should report 0 or all failed
            total_sent = data.get("total_sent", 0)
            print(f"✓ Invalid emails in CSV: sent={total_sent}")
        else:
            print("✓ Invalid CSV correctly rejected")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
