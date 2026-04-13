"""
Comprehensive regression test for earnrm CRM - Iteration 21
Tests all critical API endpoints and flows
"""
import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://earnrm-preview.preview.emergentagent.com"

TEST_EMAIL = "florian@unyted.world"
TEST_PASSWORD = "DavidConstantin18"


class TestAuth:
    """Authentication endpoint tests"""
    
    def test_login_success(self):
        """Test successful login with valid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "user_id" in data
        assert data["email"] == TEST_EMAIL
        assert data["role"] == "super_admin"
    
    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@example.com",
            "password": "wrongpass"
        })
        assert response.status_code in [401, 404]


class TestCompanies:
    """Companies API tests - CRITICAL (user reported issue)"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_companies(self, auth_token):
        """Test GET /api/companies returns company list"""
        response = requests.get(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 1  # Should have at least one company
        # Verify company structure
        if len(data) > 0:
            company = data[0]
            assert "company_id" in company
            assert "name" in company
    
    def test_create_company(self, auth_token):
        """Test POST /api/companies creates a company"""
        timestamp = datetime.now().strftime("%H%M%S")
        response = requests.post(
            f"{BASE_URL}/api/companies",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={
                "name": f"TEST_Company_{timestamp}",
                "industry": "Testing",
                "website": "https://test.com"
            }
        )
        assert response.status_code in [200, 201]
        data = response.json()
        assert "company_id" in data
        assert data["name"] == f"TEST_Company_{timestamp}"


class TestLeads:
    """Leads API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_leads(self, auth_token):
        """Test GET /api/leads returns lead list"""
        response = requests.get(
            f"{BASE_URL}/api/leads",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestContacts:
    """Contacts API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_contacts(self, auth_token):
        """Test GET /api/contacts returns contact list"""
        response = requests.get(
            f"{BASE_URL}/api/contacts",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestDeals:
    """Deals API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_deals(self, auth_token):
        """Test GET /api/deals returns deal list"""
        response = requests.get(
            f"{BASE_URL}/api/deals",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestTasks:
    """Tasks API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_tasks(self, auth_token):
        """Test GET /api/tasks returns task list"""
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)


class TestCalls:
    """Calls API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_calls(self, auth_token):
        """Test GET /api/calls returns call list"""
        response = requests.get(
            f"{BASE_URL}/api/calls",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_call_stats(self, auth_token):
        """Test GET /api/calls/stats/overview returns stats"""
        response = requests.get(
            f"{BASE_URL}/api/calls/stats/overview",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_calls" in data


class TestChatChannels:
    """Chat API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_channels(self, auth_token):
        """Test GET /api/chat/channels returns channel list"""
        response = requests.get(
            f"{BASE_URL}/api/chat/channels",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns {channels: [...]} object
        assert "channels" in data
        assert isinstance(data["channels"], list)


class TestDashboard:
    """Dashboard API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_dashboard_stats(self, auth_token):
        """Test GET /api/dashboard/stats returns stats"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/stats",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "total_leads" in data or "leads" in data or "pipeline_value" in data


class TestAdmin:
    """Admin API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_get_admin_users(self, auth_token):
        """Test GET /api/admin/users returns user list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/users",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        # API returns {users: [...], count: N} object
        assert "users" in data
        assert isinstance(data["users"], list)
        assert "count" in data
    
    def test_get_admin_organizations(self, auth_token):
        """Test GET /api/admin/organizations returns org list"""
        response = requests.get(
            f"{BASE_URL}/api/admin/organizations",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
    
    def test_get_contact_requests(self, auth_token):
        """Test GET /api/admin/contact-requests (Support tab)"""
        response = requests.get(
            f"{BASE_URL}/api/admin/contact-requests",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200


class TestBulkOperations:
    """Bulk operations API tests"""
    
    @pytest.fixture
    def auth_token(self):
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        return response.json()["token"]
    
    def test_bulk_delete_endpoint_exists(self, auth_token):
        """Test POST /api/bulk/delete endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/bulk/delete",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"entity_type": "lead", "entity_ids": []}
        )
        # Empty array should return success or validation error
        assert response.status_code in [200, 422]
    
    def test_bulk_update_endpoint_exists(self, auth_token):
        """Test POST /api/bulk/update endpoint exists"""
        response = requests.post(
            f"{BASE_URL}/api/bulk/update",
            headers={"Authorization": f"Bearer {auth_token}"},
            json={"entity_type": "lead", "entity_ids": [], "updates": {}}
        )
        assert response.status_code in [200, 422]


class TestHealth:
    """Health check tests"""
    
    def test_health_endpoint(self):
        """Test /api/health returns healthy"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "healthy"


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
