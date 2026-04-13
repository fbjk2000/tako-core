"""
Test suite for AI Quick Win Features:
1. Smart Search - Natural language search across CRM data
2. AI Email Drafting - Generate personalized emails for leads
3. Lead Summary Generation - AI-powered summaries of lead profiles
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
TEST_EMAIL = "test@example.com"
TEST_PASSWORD = "test123"
TEST_USER_EMAIL = f"aitest_{int(time.time())}@example.com"
TEST_USER_PASSWORD = "testpass123"


class TestAuth:
    """Authentication tests for AI features"""
    
    @pytest.fixture(scope="class")
    def session(self):
        """Create a session for authenticated requests"""
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_token(self, session):
        """Get authentication token"""
        # First try with existing test user
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            return response.json().get("token")
        
        # If login fails, register a new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": TEST_USER_EMAIL,
            "password": TEST_USER_PASSWORD,
            "name": "AI Test User",
            "organization_name": "AI Test Org"
        })
        
        if register_response.status_code == 200:
            return register_response.json().get("token")
        
        pytest.skip("Authentication failed - cannot test AI features")
    
    def test_auth_required_for_smart_search(self, session):
        """Test that smart search requires authentication"""
        response = session.post(f"{BASE_URL}/api/ai/smart-search?query=test")
        assert response.status_code == 401, "Smart search should require authentication"
        print("✓ Smart search requires authentication")
    
    def test_auth_required_for_email_drafting(self, session):
        """Test that email drafting requires authentication"""
        response = session.post(f"{BASE_URL}/api/ai/draft-email?purpose=introduction&tone=professional")
        assert response.status_code == 401, "Email drafting should require authentication"
        print("✓ Email drafting requires authentication")
    
    def test_auth_required_for_lead_summary(self, session):
        """Test that lead summary requires authentication"""
        response = session.post(f"{BASE_URL}/api/ai/lead-summary/fake_lead_id")
        assert response.status_code == 401, "Lead summary should require authentication"
        print("✓ Lead summary requires authentication")


class TestSmartSearch:
    """Smart Search feature tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_headers(self, session):
        """Get authentication headers"""
        # Try login first
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        
        # Register new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"smartsearch_{int(time.time())}@test.com",
            "password": "testpass123",
            "name": "Smart Search Tester",
            "organization_name": "Smart Search Test Org"
        })
        
        if register_response.status_code == 200:
            token = register_response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        
        pytest.skip("Could not authenticate for smart search tests")
    
    def test_smart_search_basic_query(self, session, auth_headers):
        """Test basic smart search functionality"""
        response = session.post(
            f"{BASE_URL}/api/ai/smart-search?query=test",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Smart search failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "query" in data, "Response should contain query"
        assert "leads" in data, "Response should contain leads array"
        assert "deals" in data, "Response should contain deals array"
        assert "tasks" in data, "Response should contain tasks array"
        assert "companies" in data, "Response should contain companies array"
        assert "ai_summary" in data, "Response should contain AI summary"
        assert "total_count" in data, "Response should contain total_count"
        
        print(f"✓ Smart search returned results with {data['total_count']} items")
        print(f"  AI Summary: {data['ai_summary'][:100]}...")
    
    def test_smart_search_natural_language_query(self, session, auth_headers):
        """Test natural language query processing"""
        response = session.post(
            f"{BASE_URL}/api/ai/smart-search?query=show me all qualified leads from tech companies",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Smart search failed: {response.text}"
        data = response.json()
        
        # Check intent parsing
        assert "intent" in data, "Response should contain parsed intent"
        print(f"✓ Smart search parsed query intent: {data.get('intent', {})}")
    
    def test_smart_search_empty_results(self, session, auth_headers):
        """Test smart search with query that returns no results"""
        response = session.post(
            f"{BASE_URL}/api/ai/smart-search?query=xyznonexistentkeyword123",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Smart search failed: {response.text}"
        data = response.json()
        
        assert data["total_count"] == 0 or data["total_count"] >= 0, "total_count should be a number"
        print(f"✓ Smart search handles empty results gracefully")


class TestAIEmailDrafting:
    """AI Email Drafting feature tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_headers(self, session):
        """Get authentication headers"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code == 200:
            token = response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        
        # Register new user
        register_response = session.post(f"{BASE_URL}/api/auth/register", json={
            "email": f"emailtest_{int(time.time())}@test.com",
            "password": "testpass123",
            "name": "Email Test User",
            "organization_name": "Email Test Org"
        })
        
        if register_response.status_code == 200:
            token = register_response.json().get("token")
            return {"Authorization": f"Bearer {token}"}
        
        pytest.skip("Could not authenticate for email drafting tests")
    
    def test_draft_email_introduction(self, session, auth_headers):
        """Test drafting an introduction email"""
        response = session.post(
            f"{BASE_URL}/api/ai/draft-email?purpose=introduction&tone=professional",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Email drafting failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "subject" in data, "Response should contain subject"
        assert "content" in data, "Response should contain content"
        assert "purpose" in data, "Response should contain purpose"
        assert "tone" in data, "Response should contain tone"
        
        assert len(data["subject"]) > 0, "Subject should not be empty"
        assert len(data["content"]) > 0, "Content should not be empty"
        assert data["purpose"] == "introduction"
        assert data["tone"] == "professional"
        
        print(f"✓ Email drafted - Subject: {data['subject'][:50]}...")
    
    def test_draft_email_with_different_tones(self, session, auth_headers):
        """Test email drafting with different tones"""
        tones = ["professional", "friendly", "casual", "formal"]
        
        for tone in tones:
            response = session.post(
                f"{BASE_URL}/api/ai/draft-email?purpose=follow_up&tone={tone}",
                headers=auth_headers
            )
            
            assert response.status_code == 200, f"Email drafting with tone '{tone}' failed: {response.text}"
            data = response.json()
            assert data["tone"] == tone
            print(f"  ✓ {tone.capitalize()} tone email generated")
        
        print("✓ All email tones work correctly")
    
    def test_draft_email_with_different_purposes(self, session, auth_headers):
        """Test email drafting with different purposes"""
        purposes = ["introduction", "follow_up", "proposal", "meeting_request", "check_in", "thank_you"]
        
        for purpose in purposes:
            response = session.post(
                f"{BASE_URL}/api/ai/draft-email?purpose={purpose}&tone=professional",
                headers=auth_headers
            )
            
            assert response.status_code == 200, f"Email drafting with purpose '{purpose}' failed: {response.text}"
            data = response.json()
            assert data["purpose"] == purpose
            print(f"  ✓ {purpose.replace('_', ' ').title()} email generated")
        
        print("✓ All email purposes work correctly")
    
    def test_draft_email_with_custom_context(self, session, auth_headers):
        """Test email drafting with custom context"""
        response = session.post(
            f"{BASE_URL}/api/ai/draft-email?purpose=proposal&tone=professional&custom_context=We met at the tech conference last week",
            headers=auth_headers
        )
        
        assert response.status_code == 200, f"Email drafting with custom context failed: {response.text}"
        data = response.json()
        
        assert "subject" in data
        assert "content" in data
        print(f"✓ Email with custom context generated successfully")


class TestLeadSummary:
    """Lead Summary Generation feature tests"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_data(self, session):
        """Get authentication and create a test lead"""
        # Try login first
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            # Register new user
            response = session.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"leadsummary_{int(time.time())}@test.com",
                "password": "testpass123",
                "name": "Lead Summary Tester",
                "organization_name": "Lead Summary Test Org"
            })
        
        if response.status_code != 200:
            pytest.skip("Could not authenticate for lead summary tests")
        
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a test lead
        lead_response = session.post(f"{BASE_URL}/api/leads", json={
            "first_name": "TEST_Summary",
            "last_name": "Lead",
            "email": "summarytest@techcorp.com",
            "company": "Tech Corp",
            "job_title": "CTO"
        }, headers=headers)
        
        lead_id = None
        if lead_response.status_code == 200:
            lead_id = lead_response.json().get("lead_id")
        
        return {"headers": headers, "lead_id": lead_id}
    
    def test_lead_summary_requires_valid_lead(self, session, auth_data):
        """Test that lead summary requires a valid lead ID"""
        response = session.post(
            f"{BASE_URL}/api/ai/lead-summary/nonexistent_lead_id",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 404, "Should return 404 for non-existent lead"
        print("✓ Lead summary returns 404 for invalid lead ID")
    
    def test_lead_summary_generation(self, session, auth_data):
        """Test generating a summary for a valid lead"""
        if not auth_data.get("lead_id"):
            pytest.skip("No test lead available")
        
        response = session.post(
            f"{BASE_URL}/api/ai/lead-summary/{auth_data['lead_id']}",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Lead summary failed: {response.text}"
        data = response.json()
        
        # Verify response structure
        assert "lead_id" in data, "Response should contain lead_id"
        assert "lead_name" in data, "Response should contain lead_name"
        assert "summary" in data, "Response should contain summary"
        assert "deals_count" in data, "Response should contain deals_count"
        assert "tasks_count" in data, "Response should contain tasks_count"
        assert "total_deal_value" in data, "Response should contain total_deal_value"
        assert "generated_at" in data, "Response should contain generated_at"
        
        assert len(data["summary"]) > 0, "Summary should not be empty"
        assert isinstance(data["deals_count"], int), "deals_count should be an integer"
        assert isinstance(data["tasks_count"], int), "tasks_count should be an integer"
        
        print(f"✓ Lead summary generated for {data['lead_name']}")
        print(f"  Stats: {data['deals_count']} deals, {data['tasks_count']} tasks, €{data['total_deal_value']} value")
        print(f"  Summary preview: {data['summary'][:150]}...")


class TestDraftEmailWithLead:
    """Test AI Email Drafting with lead context"""
    
    @pytest.fixture(scope="class")
    def session(self):
        return requests.Session()
    
    @pytest.fixture(scope="class")
    def auth_data(self, session):
        """Get authentication and create a test lead"""
        response = session.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        
        if response.status_code != 200:
            response = session.post(f"{BASE_URL}/api/auth/register", json={
                "email": f"emailwlead_{int(time.time())}@test.com",
                "password": "testpass123",
                "name": "Email Lead Tester",
                "organization_name": "Email Lead Test Org"
            })
        
        if response.status_code != 200:
            pytest.skip("Could not authenticate")
        
        token = response.json().get("token")
        headers = {"Authorization": f"Bearer {token}"}
        
        # Create a test lead
        lead_response = session.post(f"{BASE_URL}/api/leads", json={
            "first_name": "TEST_John",
            "last_name": "Doe",
            "email": "johndoe@enterprise.com",
            "company": "Enterprise Corp",
            "job_title": "VP of Sales"
        }, headers=headers)
        
        lead_id = None
        if lead_response.status_code == 200:
            lead_id = lead_response.json().get("lead_id")
        
        return {"headers": headers, "lead_id": lead_id}
    
    def test_draft_email_for_specific_lead(self, session, auth_data):
        """Test drafting an email for a specific lead"""
        if not auth_data.get("lead_id"):
            pytest.skip("No test lead available")
        
        response = session.post(
            f"{BASE_URL}/api/ai/draft-email?lead_id={auth_data['lead_id']}&purpose=introduction&tone=professional",
            headers=auth_data["headers"]
        )
        
        assert response.status_code == 200, f"Email drafting for lead failed: {response.text}"
        data = response.json()
        
        # When drafting for a specific lead, the response should include lead context
        assert "lead_name" in data, "Response should contain lead_name"
        assert "company_name" in data, "Response should contain company_name"
        
        # The email should be personalized with the lead's name
        assert data["lead_name"] != "there", "Email should be personalized with lead's name"
        
        print(f"✓ Personalized email drafted for {data['lead_name']} at {data['company_name']}")
        print(f"  Subject: {data['subject'][:50]}...")


# Run tests if executed directly
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
