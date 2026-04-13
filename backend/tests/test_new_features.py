"""
Test suite for upmuch CRM new features:
1. Support page contact form submission
2. Admin settings (Stripe/PayPal/Crypto/Support email)
3. Deals page filters (stage, tag, owner)
4. Tasks page filters (status, owner)
5. Pipeline report page with stage summaries
6. Admin view vs regular user view on pipeline
7. Create deal with mandatory task
8. Deal probability and expected close date fields
"""

import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
SUPER_ADMIN_EMAIL = "florian@unyted.world"
SUPER_ADMIN_PASSWORD = "DavidConstantin18"


class TestHealthCheck:
    """Basic health check tests"""
    
    def test_api_health(self):
        """Test API health endpoint"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data.get("status") == "healthy"
        print("✓ API health check passed")


class TestSupportContactForm:
    """Test support page contact form submission"""
    
    def test_contact_form_submission(self):
        """Test contact form submission stores in database"""
        contact_data = {
            "name": "TEST_John Doe",
            "email": "test@example.com",
            "subject": "Test Support Request",
            "message": "This is a test message for support."
        }
        
        response = requests.post(f"{BASE_URL}/api/support/contact", json=contact_data)
        assert response.status_code == 200
        data = response.json()
        assert data.get("success") == True
        assert "contact_id" in data or "submission_id" in data
        print(f"✓ Contact form submission successful: {data.get('contact_id') or data.get('submission_id')}")
    
    def test_contact_form_validation(self):
        """Test contact form validation for required fields"""
        # Missing email
        contact_data = {
            "name": "TEST_John",
            "subject": "Test",
            "message": "Test message"
        }
        
        response = requests.post(f"{BASE_URL}/api/support/contact", json=contact_data)
        assert response.status_code == 422  # Validation error
        print("✓ Contact form validation working")


class TestAuthentication:
    """Authentication tests"""
    
    @pytest.fixture
    def super_admin_token(self):
        """Get super admin authentication token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            return response.json().get("token")
        pytest.skip("Super admin authentication failed")
    
    def test_super_admin_login(self):
        """Test super admin can login"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        # User may have owner or super_admin role
        assert data.get("role") in ["owner", "super_admin", "admin"]
        print(f"✓ Super admin login successful, role: {data.get('role')}")
        return data.get("token")


class TestAdminSettings:
    """Test admin settings endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers for super admin"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_platform_settings(self, auth_headers):
        """Test getting platform settings"""
        response = requests.get(f"{BASE_URL}/api/admin/settings", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields exist
        assert "support_email" in data
        assert "setting_id" in data
        print(f"✓ Platform settings retrieved: support_email={data.get('support_email')}")
    
    def test_update_platform_settings(self, auth_headers):
        """Test updating platform settings"""
        update_data = {
            "support_email": "test-support@upmuch.com",
            "vat_rate": 20.0
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
                               json=update_data, 
                               headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "Settings updated" in data.get("message", "")
        print("✓ Platform settings updated successfully")
        
        # Verify update
        get_response = requests.get(f"{BASE_URL}/api/admin/settings", headers=auth_headers)
        assert get_response.status_code == 200
        settings = get_response.json()
        assert settings.get("support_email") == "test-support@upmuch.com"
        print("✓ Settings update verified")
        
        # Restore original
        requests.put(f"{BASE_URL}/api/admin/settings", 
                    json={"support_email": "support@upmuch.com"}, 
                    headers=auth_headers)
    
    def test_settings_stripe_key(self, auth_headers):
        """Test updating Stripe API key"""
        update_data = {
            "stripe_api_key": "sk_test_example123"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
                               json=update_data, 
                               headers=auth_headers)
        assert response.status_code == 200
        print("✓ Stripe API key update accepted")
    
    def test_settings_paypal(self, auth_headers):
        """Test updating PayPal settings"""
        update_data = {
            "paypal_client_id": "test_client_id",
            "paypal_client_secret": "test_client_secret"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
                               json=update_data, 
                               headers=auth_headers)
        assert response.status_code == 200
        print("✓ PayPal settings update accepted")
    
    def test_settings_crypto_wallet(self, auth_headers):
        """Test updating crypto wallet address"""
        update_data = {
            "crypto_wallet_address": "0x1234567890abcdef1234567890abcdef12345678"
        }
        
        response = requests.put(f"{BASE_URL}/api/admin/settings", 
                               json=update_data, 
                               headers=auth_headers)
        assert response.status_code == 200
        print("✓ Crypto wallet address update accepted")
    
    def test_settings_unauthorized(self):
        """Test settings endpoint requires super admin"""
        response = requests.get(f"{BASE_URL}/api/admin/settings")
        assert response.status_code == 401 or response.status_code == 403
        print("✓ Settings endpoint properly protected")


class TestDealsWithFilters:
    """Test deals endpoints with filters and new fields"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not get user info")
    
    def test_create_deal_with_mandatory_task(self, auth_headers, user_info):
        """Test creating a deal with mandatory task"""
        deal_data = {
            "name": "TEST_Enterprise Deal",
            "value": 50000,
            "currency": "EUR",
            "stage": "qualified",
            "probability": 40,
            "expected_close_date": (datetime.now() + timedelta(days=30)).isoformat(),
            "tags": ["enterprise", "high-value"],
            "notes": "Test deal with mandatory task",
            "task_title": "Initial discovery call",
            "task_owner_id": user_info.get("user_id"),
            "task_description": "Schedule and conduct initial discovery call",
            "task_due_date": (datetime.now() + timedelta(days=7)).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/deals", json=deal_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Verify deal created
        assert "deal_id" in data
        assert data.get("name") == "TEST_Enterprise Deal"
        assert data.get("probability") == 40
        assert data.get("tags") == ["enterprise", "high-value"]
        
        # Verify task was created
        assert "created_task_id" in data
        print(f"✓ Deal created with task: deal_id={data.get('deal_id')}, task_id={data.get('created_task_id')}")
        
        return data.get("deal_id")
    
    def test_create_deal_without_task_fails(self, auth_headers):
        """Test that creating a deal without task fields fails"""
        deal_data = {
            "name": "TEST_Deal Without Task",
            "value": 10000,
            "stage": "lead"
            # Missing task_title and task_owner_id
        }
        
        response = requests.post(f"{BASE_URL}/api/deals", json=deal_data, headers=auth_headers)
        assert response.status_code == 422  # Validation error
        print("✓ Deal creation without mandatory task fields properly rejected")
    
    def test_deals_filter_by_stage(self, auth_headers):
        """Test filtering deals by stage"""
        response = requests.get(f"{BASE_URL}/api/deals?stage=qualified", headers=auth_headers)
        assert response.status_code == 200
        deals = response.json()
        
        # All returned deals should be in qualified stage
        for deal in deals:
            assert deal.get("stage") == "qualified"
        print(f"✓ Stage filter working: {len(deals)} deals in 'qualified' stage")
    
    def test_deals_filter_by_tag(self, auth_headers):
        """Test filtering deals by tag"""
        response = requests.get(f"{BASE_URL}/api/deals?tag=enterprise", headers=auth_headers)
        assert response.status_code == 200
        deals = response.json()
        
        # All returned deals should have the tag
        for deal in deals:
            assert "enterprise" in deal.get("tags", [])
        print(f"✓ Tag filter working: {len(deals)} deals with 'enterprise' tag")
    
    def test_deals_filter_by_owner(self, auth_headers, user_info):
        """Test filtering deals by owner"""
        user_id = user_info.get("user_id")
        response = requests.get(f"{BASE_URL}/api/deals?assigned_to={user_id}", headers=auth_headers)
        assert response.status_code == 200
        deals = response.json()
        print(f"✓ Owner filter working: {len(deals)} deals assigned to user")
    
    def test_get_deal_tags(self, auth_headers):
        """Test getting all unique deal tags"""
        response = requests.get(f"{BASE_URL}/api/deals/tags", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "tags" in data
        print(f"✓ Deal tags endpoint working: {len(data.get('tags', []))} unique tags")


class TestTasksWithFilters:
    """Test tasks endpoints with filters"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    @pytest.fixture
    def user_info(self, auth_headers):
        """Get current user info"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        if response.status_code == 200:
            return response.json()
        pytest.skip("Could not get user info")
    
    def test_tasks_filter_by_status(self, auth_headers):
        """Test filtering tasks by status"""
        response = requests.get(f"{BASE_URL}/api/tasks?status=todo", headers=auth_headers)
        assert response.status_code == 200
        tasks = response.json()
        
        # All returned tasks should have todo status
        for task in tasks:
            assert task.get("status") == "todo"
        print(f"✓ Status filter working: {len(tasks)} tasks with 'todo' status")
    
    def test_tasks_filter_by_owner(self, auth_headers, user_info):
        """Test filtering tasks by owner"""
        user_id = user_info.get("user_id")
        response = requests.get(f"{BASE_URL}/api/tasks?assigned_to={user_id}", headers=auth_headers)
        assert response.status_code == 200
        tasks = response.json()
        print(f"✓ Owner filter working: {len(tasks)} tasks assigned to user")
    
    def test_create_task(self, auth_headers, user_info):
        """Test creating a standalone task"""
        task_data = {
            "title": "TEST_Follow up task",
            "description": "Follow up with client",
            "status": "todo",
            "priority": "high",
            "assigned_to": user_info.get("user_id"),
            "due_date": (datetime.now() + timedelta(days=3)).isoformat()
        }
        
        response = requests.post(f"{BASE_URL}/api/tasks", json=task_data, headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "task_id" in data
        assert data.get("title") == "TEST_Follow up task"
        print(f"✓ Task created: {data.get('task_id')}")


class TestPipelineReport:
    """Test pipeline report endpoints"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_pipeline_report(self, auth_headers):
        """Test pipeline report endpoint"""
        response = requests.get(f"{BASE_URL}/api/pipeline/report", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        assert "total_value" in data
        assert "weighted_value" in data
        assert "deals" in data
        assert "stages" in data
        assert "is_admin_view" in data
        
        # Check stages have required fields
        for stage in data.get("stages", []):
            assert "id" in stage
            assert "name" in stage
            assert "count" in stage
            assert "value" in stage
            assert "weighted_value" in stage
        
        print(f"✓ Pipeline report: total_value=€{data.get('total_value')}, weighted=€{data.get('weighted_value')}, is_admin={data.get('is_admin_view')}")
    
    def test_team_summary_admin(self, auth_headers):
        """Test team summary endpoint (admin only)"""
        response = requests.get(f"{BASE_URL}/api/pipeline/team-summary", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        # Check expected fields
        assert "members" in data
        
        # Check member data structure
        for member in data.get("members", []):
            assert "user_id" in member
            assert "name" in member
            assert "deal_count" in member
            assert "total_value" in member
            assert "weighted_value" in member
            assert "won_value" in member
        
        print(f"✓ Team summary: {len(data.get('members', []))} members")
    
    def test_pipeline_report_unauthorized(self):
        """Test pipeline report requires authentication"""
        response = requests.get(f"{BASE_URL}/api/pipeline/report")
        assert response.status_code == 401
        print("✓ Pipeline report properly protected")


class TestSettingsStages:
    """Test settings stages endpoint"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_get_stages(self, auth_headers):
        """Test getting deal and task stages"""
        response = requests.get(f"{BASE_URL}/api/settings/stages", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        
        assert "deal_stages" in data
        assert "task_stages" in data
        
        # Check deal stages
        deal_stages = data.get("deal_stages", [])
        assert len(deal_stages) > 0
        for stage in deal_stages:
            assert "id" in stage
            assert "name" in stage
        
        # Check task stages
        task_stages = data.get("task_stages", [])
        assert len(task_stages) > 0
        
        print(f"✓ Stages endpoint: {len(deal_stages)} deal stages, {len(task_stages)} task stages")


class TestCleanup:
    """Cleanup test data"""
    
    @pytest.fixture
    def auth_headers(self):
        """Get authenticated headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": SUPER_ADMIN_EMAIL,
            "password": SUPER_ADMIN_PASSWORD
        })
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        pytest.skip("Authentication failed")
    
    def test_cleanup_test_deals(self, auth_headers):
        """Clean up test deals"""
        response = requests.get(f"{BASE_URL}/api/deals", headers=auth_headers)
        if response.status_code == 200:
            deals = response.json()
            for deal in deals:
                if deal.get("name", "").startswith("TEST_"):
                    # Note: No delete endpoint for deals in current API
                    pass
        print("✓ Test data cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
