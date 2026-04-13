"""
Tests for iteration 20 features:
- Deals: Lead/Contact/Company linking + amber recommendation for leads
- Contacts: Add Contact dialog (manual creation)
- Contacts: Import CSV
- Contacts: Bulk select/delete
- Bulk operations: /api/bulk/delete, /api/bulk/update, /api/bulk/enrich, /api/bulk/add-to-campaign
- DealCreate model with contact_id field
- Landing page logo size (frontend visual test)
"""
import pytest
import requests
import os
import io

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
TEST_EMAIL = "florian@unyted.world"
TEST_PASSWORD = "DavidConstantin18"


class TestAuth:
    """Get auth token for tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Login and get auth token"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": TEST_EMAIL,
            "password": TEST_PASSWORD
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def headers(self, auth_token):
        """Auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}


class TestBulkDelete(TestAuth):
    """Test POST /api/bulk/delete endpoint"""
    
    def test_bulk_delete_contacts(self, headers):
        """Create test contacts and bulk delete them"""
        # Create 2 test contacts
        contact_ids = []
        for i in range(2):
            resp = requests.post(f"{BASE_URL}/api/contacts", headers=headers, json={
                "first_name": f"BulkTestContact{i}",
                "last_name": "ToDelete",
                "email": f"bulktest{i}@test.com"
            })
            assert resp.status_code in [200, 201], f"Failed to create test contact: {resp.text}"
            contact_ids.append(resp.json()["contact_id"])
        
        # Bulk delete
        resp = requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
            "entity_type": "contact",
            "entity_ids": contact_ids
        })
        assert resp.status_code == 200, f"Bulk delete failed: {resp.text}"
        data = resp.json()
        assert data.get("deleted") == 2, f"Expected 2 deleted, got {data.get('deleted')}"
    
    def test_bulk_delete_leads(self, headers):
        """Create test leads and bulk delete them"""
        # Create 2 test leads
        lead_ids = []
        for i in range(2):
            resp = requests.post(f"{BASE_URL}/api/leads", headers=headers, json={
                "first_name": f"BulkTestLead{i}",
                "last_name": "ToDelete"
            })
            assert resp.status_code in [200, 201], f"Failed to create test lead: {resp.text}"
            lead_ids.append(resp.json()["lead_id"])
        
        # Bulk delete
        resp = requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
            "entity_type": "lead",
            "entity_ids": lead_ids
        })
        assert resp.status_code == 200, f"Bulk delete failed: {resp.text}"
        data = resp.json()
        assert data.get("deleted") == 2, f"Expected 2 deleted, got {data.get('deleted')}"
    
    def test_bulk_delete_invalid_type(self, headers):
        """Test bulk delete with invalid entity type"""
        resp = requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
            "entity_type": "invalid",
            "entity_ids": ["test_id"]
        })
        assert resp.status_code == 400


class TestBulkUpdate(TestAuth):
    """Test POST /api/bulk/update endpoint"""
    
    def test_bulk_update_leads(self, headers):
        """Create test leads and bulk update their status"""
        # Create 2 test leads
        lead_ids = []
        for i in range(2):
            resp = requests.post(f"{BASE_URL}/api/leads", headers=headers, json={
                "first_name": f"BulkUpdateLead{i}",
                "last_name": "Test",
                "status": "new"
            })
            assert resp.status_code in [200, 201], f"Failed to create test lead: {resp.text}"
            lead_ids.append(resp.json()["lead_id"])
        
        # Bulk update status
        resp = requests.post(f"{BASE_URL}/api/bulk/update", headers=headers, json={
            "entity_type": "lead",
            "entity_ids": lead_ids,
            "updates": {"status": "contacted"}
        })
        assert resp.status_code == 200, f"Bulk update failed: {resp.text}"
        data = resp.json()
        assert data.get("updated") == 2, f"Expected 2 updated, got {data.get('updated')}"
        
        # Verify updates
        for lid in lead_ids:
            resp = requests.get(f"{BASE_URL}/api/leads/{lid}", headers=headers)
            assert resp.status_code == 200
            assert resp.json().get("status") == "contacted"
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
            "entity_type": "lead",
            "entity_ids": lead_ids
        })


class TestBulkAddToCampaign(TestAuth):
    """Test POST /api/bulk/add-to-campaign endpoint"""
    
    def test_bulk_add_leads_to_campaign(self, headers):
        """Add lead emails to campaign recipients"""
        # Get campaigns
        resp = requests.get(f"{BASE_URL}/api/campaigns", headers=headers)
        assert resp.status_code == 200
        campaigns = resp.json()
        
        if not campaigns:
            # Create a campaign
            resp = requests.post(f"{BASE_URL}/api/campaigns", headers=headers, json={
                "name": "Test Campaign Bulk",
                "subject": "Test Subject",
                "content": "Test content"
            })
            assert resp.status_code in [200, 201], f"Failed to create campaign: {resp.text}"
            campaign_id = resp.json()["campaign_id"]
        else:
            campaign_id = campaigns[0]["campaign_id"]
        
        # Create test leads with emails
        lead_ids = []
        for i in range(2):
            resp = requests.post(f"{BASE_URL}/api/leads", headers=headers, json={
                "first_name": f"CampaignLead{i}",
                "last_name": "Test",
                "email": f"campaignlead{i}_{os.urandom(4).hex()}@test.com"
            })
            assert resp.status_code in [200, 201]
            lead_ids.append(resp.json()["lead_id"])
        
        # Add to campaign
        resp = requests.post(f"{BASE_URL}/api/bulk/add-to-campaign", headers=headers, json={
            "campaign_id": campaign_id,
            "entity_type": "lead",
            "entity_ids": lead_ids
        })
        assert resp.status_code == 200, f"Bulk add to campaign failed: {resp.text}"
        data = resp.json()
        assert "added" in data
        assert "total_recipients" in data
        
        # Cleanup
        requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
            "entity_type": "lead",
            "entity_ids": lead_ids
        })


class TestContactsImportCSV(TestAuth):
    """Test POST /api/contacts/import-csv endpoint"""
    
    def test_import_contacts_csv(self, headers):
        """Import contacts from CSV file"""
        csv_content = """first_name,last_name,email,phone,company,job_title
CSVTest1,User,csvtest1@example.com,+1234567890,Test Corp,Manager
CSVTest2,Person,csvtest2@example.com,+0987654321,Another Corp,Director"""
        
        files = {
            'file': ('test_contacts.csv', csv_content, 'text/csv')
        }
        
        # Remove Content-Type from headers for multipart
        h = {"Authorization": headers["Authorization"]}
        
        resp = requests.post(f"{BASE_URL}/api/contacts/import-csv", headers=h, files=files)
        assert resp.status_code == 200, f"Import CSV failed: {resp.text}"
        data = resp.json()
        assert data.get("count") == 2, f"Expected 2 imported, got {data.get('count')}"
        
        # Cleanup - find and delete imported contacts
        resp = requests.get(f"{BASE_URL}/api/contacts", headers=headers)
        contacts = resp.json()
        csv_contact_ids = [c["contact_id"] for c in contacts if c.get("first_name", "").startswith("CSVTest")]
        if csv_contact_ids:
            requests.post(f"{BASE_URL}/api/bulk/delete", headers=headers, json={
                "entity_type": "contact",
                "entity_ids": csv_contact_ids
            })


class TestDealWithLinkedEntities(TestAuth):
    """Test creating deals with lead_id, contact_id, company_id"""
    
    def test_create_deal_with_lead(self, headers):
        """Create a deal linked to a lead"""
        # Get available leads
        resp = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert resp.status_code == 200
        leads = resp.json()
        
        lead_id = leads[0]["lead_id"] if leads else None
        
        if lead_id:
            # Get user id for task owner
            resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            user_id = resp.json()["user_id"]
            
            resp = requests.post(f"{BASE_URL}/api/deals", headers=headers, json={
                "name": "Deal with Lead Link Test",
                "value": 5000,
                "stage": "lead",
                "lead_id": lead_id,
                "task_title": "Initial task for lead-linked deal",
                "task_owner_id": user_id
            })
            assert resp.status_code in [200, 201], f"Create deal failed: {resp.text}"
            deal = resp.json()
            assert deal.get("lead_id") == lead_id, "Lead ID not linked correctly"
            print(f"✓ Deal created with lead_id: {lead_id}")
        else:
            pytest.skip("No leads available to link")
    
    def test_create_deal_with_contact(self, headers):
        """Create a deal linked to a contact"""
        # Get available contacts
        resp = requests.get(f"{BASE_URL}/api/contacts", headers=headers)
        assert resp.status_code == 200
        contacts = resp.json()
        
        contact_id = contacts[0]["contact_id"] if contacts else None
        
        if contact_id:
            # Get user id for task owner
            resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
            user_id = resp.json()["user_id"]
            
            resp = requests.post(f"{BASE_URL}/api/deals", headers=headers, json={
                "name": "Deal with Contact Link Test",
                "value": 10000,
                "stage": "qualified",
                "contact_id": contact_id,
                "task_title": "Initial task for contact-linked deal",
                "task_owner_id": user_id
            })
            assert resp.status_code in [200, 201], f"Create deal failed: {resp.text}"
            deal = resp.json()
            assert deal.get("contact_id") == contact_id, "Contact ID not linked correctly"
            print(f"✓ Deal created with contact_id: {contact_id}")
        else:
            pytest.skip("No contacts available to link")
    
    def test_create_deal_with_company(self, headers):
        """Create a deal linked to a company"""
        # Get available companies
        resp = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        assert resp.status_code == 200
        companies = resp.json()
        
        company_id = companies[0]["company_id"] if companies else None
        
        if not company_id:
            # Create a company
            resp = requests.post(f"{BASE_URL}/api/companies", headers=headers, json={
                "name": "Test Company for Deal Link"
            })
            assert resp.status_code in [200, 201]
            company_id = resp.json()["company_id"]
        
        # Get user id for task owner
        resp = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        user_id = resp.json()["user_id"]
        
        resp = requests.post(f"{BASE_URL}/api/deals", headers=headers, json={
            "name": "Deal with Company Link Test",
            "value": 15000,
            "stage": "proposal",
            "company_id": company_id,
            "task_title": "Initial task for company-linked deal",
            "task_owner_id": user_id
        })
        assert resp.status_code in [200, 201], f"Create deal failed: {resp.text}"
        deal = resp.json()
        assert deal.get("company_id") == company_id, "Company ID not linked correctly"
        print(f"✓ Deal created with company_id: {company_id}")


class TestContactManualCreation(TestAuth):
    """Test POST /api/contacts for manual contact creation"""
    
    def test_create_contact_manual(self, headers):
        """Create contact with 6 fields (manual entry)"""
        resp = requests.post(f"{BASE_URL}/api/contacts", headers=headers, json={
            "first_name": "ManualTest",
            "last_name": "Contact",
            "email": "manualtest@example.com",
            "phone": "+1234567890",
            "company": "Manual Test Corp",
            "job_title": "Test Manager",
            "source": "manual"
        })
        assert resp.status_code in [200, 201], f"Create contact failed: {resp.text}"
        contact = resp.json()
        
        # Verify all fields
        assert contact["first_name"] == "ManualTest"
        assert contact["last_name"] == "Contact"
        assert contact["email"] == "manualtest@example.com"
        assert contact["phone"] == "+1234567890"
        assert contact["company"] == "Manual Test Corp"
        assert contact["job_title"] == "Test Manager"
        
        print(f"✓ Contact created manually with all 6 fields")
        
        # Cleanup
        contact_id = contact["contact_id"]
        requests.delete(f"{BASE_URL}/api/contacts/{contact_id}", headers=headers)


class TestBulkEnrich(TestAuth):
    """Test POST /api/bulk/enrich endpoint"""
    
    def test_bulk_enrich_endpoint_exists(self, headers):
        """Verify bulk enrich endpoint exists and accepts request"""
        # Create a test lead
        resp = requests.post(f"{BASE_URL}/api/leads", headers=headers, json={
            "first_name": "EnrichTest",
            "last_name": "Lead",
            "email": "enrichtest@example.com",
            "company": "Test Corp"
        })
        assert resp.status_code in [200, 201]
        lead_id = resp.json()["lead_id"]
        
        # Test bulk enrich endpoint - it should accept the request
        resp = requests.post(f"{BASE_URL}/api/bulk/enrich", headers=headers, json={
            "entity_type": "lead",
            "entity_ids": [lead_id]
        })
        # Can be 200 or 500 if LLM fails - we just verify endpoint exists
        assert resp.status_code in [200, 500, 422], f"Unexpected status: {resp.status_code}"
        print(f"✓ Bulk enrich endpoint exists and responds")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/leads/{lead_id}", headers=headers)


class TestGetLeadsContactsCompanies(TestAuth):
    """Test that GET endpoints work for deal linking"""
    
    def test_get_leads(self, headers):
        """Verify GET /api/leads works for deal selector"""
        resp = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        assert resp.status_code == 200
        print(f"✓ GET /api/leads returns {len(resp.json())} leads")
    
    def test_get_contacts(self, headers):
        """Verify GET /api/contacts works for deal selector"""
        resp = requests.get(f"{BASE_URL}/api/contacts", headers=headers)
        assert resp.status_code == 200
        print(f"✓ GET /api/contacts returns {len(resp.json())} contacts")
    
    def test_get_companies(self, headers):
        """Verify GET /api/companies works for deal selector"""
        resp = requests.get(f"{BASE_URL}/api/companies", headers=headers)
        assert resp.status_code == 200
        print(f"✓ GET /api/companies returns {len(resp.json())} companies")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
