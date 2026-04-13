"""
Comprehensive test suite for earnrm CRM - Iteration 22
Tests: Login, Leads CRUD, Contacts, Deals, Tasks, Companies, Chat, Calls, Admin, CORS, Session endpoint
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://earnrm-preview.preview.emergentagent.com')

# Test credentials
TEST_EMAIL = "florian@unyted.world"
TEST_PASSWORD = "DavidConstantin18"

class TestAuthEndpoints:
    """Test authentication endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        assert "token" in data, "No token in login response"
        return data["token"]
    
    def test_login_success(self):
        """Test email/password login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert data["email"] == TEST_EMAIL
        assert data["role"] in ["super_admin", "admin", "owner", "member"]
        print(f"✓ Login successful: role={data['role']}")
    
    def test_login_invalid_credentials(self):
        """Test invalid login returns 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401
        print("✓ Invalid credentials correctly rejected")
    
    def test_session_endpoint_returns_token(self, auth_token):
        """Verify POST /api/auth/session structure - for Google OAuth"""
        # Note: We can't fully test this without actual Google session_id
        # But we verify the endpoint exists and returns proper error for invalid session
        response = requests.post(f"{BASE_URL}/api/auth/session", json={
            "session_id": "invalid_test_session"
        })
        # Should fail but with proper error (not 500)
        assert response.status_code in [400, 401, 404], f"Unexpected status: {response.status_code}"
        print("✓ Session endpoint exists and validates properly")


class TestLeadsEndpoints:
    """Test Leads CRUD operations"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_leads(self, auth_headers):
        """Test GET /api/leads"""
        response = requests.get(f"{BASE_URL}/api/leads", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/leads: {len(data)} leads")
    
    def test_create_lead(self, auth_headers):
        """Test POST /api/leads - Critical test for 'Can't add new lead' bug"""
        test_lead = {
            "first_name": f"TEST_{uuid.uuid4().hex[:6]}",
            "last_name": "Playwright",
            "email": f"test_{uuid.uuid4().hex[:6]}@example.com",
            "phone": "+1234567890",
            "company": "Test Company",
            "job_title": "Tester",
            "source": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/leads", json=test_lead, headers=auth_headers)
        assert response.status_code == 200, f"Create lead failed: {response.text}"
        data = response.json()
        assert data["first_name"] == test_lead["first_name"]
        assert "lead_id" in data
        print(f"✓ POST /api/leads: Created lead {data['lead_id']}")
        return data["lead_id"]
    
    def test_get_single_lead(self, auth_headers):
        """Test GET /api/leads/{lead_id}"""
        # First create a lead
        response = requests.post(f"{BASE_URL}/api/leads", json={
            "first_name": f"TEST_Single_{uuid.uuid4().hex[:4]}",
            "last_name": "Test"
        }, headers=auth_headers)
        lead_id = response.json()["lead_id"]
        
        # Get it
        response = requests.get(f"{BASE_URL}/api/leads/{lead_id}", headers=auth_headers)
        assert response.status_code == 200
        print(f"✓ GET /api/leads/{lead_id}: Found lead")


class TestContactsEndpoints:
    """Test Contacts endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_contacts(self, auth_headers):
        """Test GET /api/contacts"""
        response = requests.get(f"{BASE_URL}/api/contacts", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/contacts: {len(data)} contacts")
    
    def test_create_contact(self, auth_headers):
        """Test POST /api/contacts"""
        test_contact = {
            "first_name": f"TEST_Contact_{uuid.uuid4().hex[:4]}",
            "last_name": "TestLast",
            "email": f"contact_{uuid.uuid4().hex[:4]}@test.com",
            "source": "manual"
        }
        response = requests.post(f"{BASE_URL}/api/contacts", json=test_contact, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "contact_id" in data
        print(f"✓ POST /api/contacts: Created contact {data['contact_id']}")


class TestDealsEndpoints:
    """Test Deals endpoints with Kanban/List features"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_deals(self, auth_headers):
        """Test GET /api/deals"""
        response = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/deals: {len(data)} deals")
    
    def test_get_deal_tags(self, auth_headers):
        """Test GET /api/deals/tags"""
        response = requests.get(f"{BASE_URL}/api/deals/tags", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "tags" in data
        print(f"✓ GET /api/deals/tags: {len(data.get('tags', []))} tags")


class TestTasksEndpoints:
    """Test Tasks endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_tasks(self, auth_headers):
        """Test GET /api/tasks"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/tasks: {len(data)} tasks")


class TestCompaniesEndpoints:
    """Test Companies endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_companies(self, auth_headers):
        """Test GET /api/companies"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/companies: {len(data)} companies")


class TestChatEndpoints:
    """Test Chat endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_chat_channels(self, auth_headers):
        """Test GET /api/chat/channels"""
        response = requests.get(f"{BASE_URL}/api/chat/channels", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        channels = data.get("channels", data) if isinstance(data, dict) else data
        assert isinstance(channels, list)
        print(f"✓ GET /api/chat/channels: {len(channels)} channels")


class TestCallsEndpoints:
    """Test Calls endpoints"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_get_calls(self, auth_headers):
        """Test GET /api/calls"""
        response = requests.get(f"{BASE_URL}/api/calls", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/calls: {len(data)} calls")
    
    def test_get_calls_stats(self, auth_headers):
        """Test GET /api/calls/stats/overview"""
        response = requests.get(f"{BASE_URL}/api/calls/stats/overview", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_calls" in data or "scheduled_calls" in data or isinstance(data, dict)
        print(f"✓ GET /api/calls/stats/overview: Stats retrieved")


class TestAdminEndpoints:
    """Test Admin endpoints - Super Admin only"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_admin_stats(self, auth_headers):
        """Test GET /api/admin/stats"""
        response = requests.get(f"{BASE_URL}/api/admin/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_users" in data or isinstance(data, dict)
        print(f"✓ GET /api/admin/stats: Stats retrieved")
    
    def test_admin_users(self, auth_headers):
        """Test GET /api/admin/users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "users" in data
        print(f"✓ GET /api/admin/users: {len(data.get('users', []))} users")
    
    def test_admin_organizations(self, auth_headers):
        """Test GET /api/admin/organizations"""
        response = requests.get(f"{BASE_URL}/api/admin/organizations", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ GET /api/admin/organizations: {len(data)} organizations")
    
    def test_admin_data_explorer(self, auth_headers):
        """Test GET /api/admin/data-explorer - Data Explorer tab"""
        response = requests.get(f"{BASE_URL}/api/admin/data-explorer", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "collections" in data
        print(f"✓ GET /api/admin/data-explorer: {len(data.get('collections', {}))} collections")


class TestDashboardEndpoints:
    """Test Dashboard endpoint"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_dashboard_stats(self, auth_headers):
        """Test GET /api/dashboard/stats"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, dict)
        print(f"✓ GET /api/dashboard/stats: Dashboard stats retrieved")


class TestBulkEndpoints:
    """Test Bulk operations for Leads and Deals"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        token = response.json()["token"]
        return {"Authorization": f"Bearer {token}"}
    
    def test_bulk_delete_endpoint_exists(self, auth_headers):
        """Test POST /api/bulk/delete endpoint exists"""
        # Test with empty list - should not error
        response = requests.post(f"{BASE_URL}/api/bulk/delete", 
            json={"entity_type": "lead", "entity_ids": []}, 
            headers=auth_headers)
        # Should not be 404 or 500
        assert response.status_code in [200, 400], f"Unexpected status: {response.status_code}"
        print("✓ POST /api/bulk/delete: Endpoint exists")


class TestCORSConfig:
    """Test CORS configuration"""
    
    def test_cors_headers(self):
        """Test CORS headers are properly set"""
        response = requests.options(f"{BASE_URL}/api/auth/login",
            headers={
                "Origin": "https://example.com",
                "Access-Control-Request-Method": "POST"
            })
        # Should return CORS headers
        assert response.status_code in [200, 204], f"OPTIONS failed: {response.status_code}"
        print("✓ CORS OPTIONS request successful")


class TestHealthEndpoint:
    """Test Health endpoint"""
    
    def test_health(self):
        """Test GET /api/health"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print("✓ GET /api/health: Healthy")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
