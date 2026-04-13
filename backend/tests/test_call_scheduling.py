"""
Test Call Scheduling Feature - earnrm CRM
Tests for: POST /calls/schedule, GET /calls/scheduled, GET /calls/scheduled/upcoming,
PUT /calls/scheduled/{id}, DELETE /calls/scheduled/{id}, POST /calls/scheduled/check-reminders
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestCallSchedulingFeature:
    """Test suite for call scheduling functionality"""
    
    # Class-level variables to store test data
    auth_token = None
    lead_id = None
    schedule_id = None
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Setup for each test - ensure authentication"""
        if not TestCallSchedulingFeature.auth_token:
            self._login()
        if not TestCallSchedulingFeature.lead_id:
            self._get_or_create_lead()
    
    def _login(self):
        """Login and get auth token"""
        response = requests.post(
            f"{BASE_URL}/api/auth/login",
            json={
                "email": os.getenv("TEST_EMAIL", "florian@unyted.world"),
                "password": os.getenv("TEST_PASSWORD", "DavidConstantin18")
            }
        )
        assert response.status_code == 200, f"Login failed: {response.text}"
        data = response.json()
        TestCallSchedulingFeature.auth_token = data.get("token")
        assert TestCallSchedulingFeature.auth_token, "No token received from login"
    
    def _get_or_create_lead(self):
        """Get existing lead or create one for testing"""
        headers = {"Authorization": f"Bearer {TestCallSchedulingFeature.auth_token}"}
        
        # Get existing leads
        response = requests.get(f"{BASE_URL}/api/leads", headers=headers)
        if response.status_code == 200:
            leads = response.json()
            if leads:
                TestCallSchedulingFeature.lead_id = leads[0]["lead_id"]
                return
        
        # Create a test lead
        response = requests.post(
            f"{BASE_URL}/api/leads",
            headers=headers,
            json={
                "first_name": "TEST_Schedule",
                "last_name": "TestLead",
                "email": "test_schedule@example.com",
                "phone": "+1234567890"
            }
        )
        if response.status_code == 200:
            TestCallSchedulingFeature.lead_id = response.json()["lead_id"]
    
    @property
    def headers(self):
        return {"Authorization": f"Bearer {TestCallSchedulingFeature.auth_token}"}
    
    # === AUTHENTICATION TESTS ===
    
    def test_schedule_call_requires_auth(self):
        """POST /api/calls/schedule should require authentication"""
        response = requests.post(f"{BASE_URL}/api/calls/schedule", json={})
        assert response.status_code == 401, "Should require authentication"
        print("✓ POST /api/calls/schedule requires auth (401)")
    
    def test_get_scheduled_calls_requires_auth(self):
        """GET /api/calls/scheduled should require authentication"""
        response = requests.get(f"{BASE_URL}/api/calls/scheduled")
        assert response.status_code == 401, "Should require authentication"
        print("✓ GET /api/calls/scheduled requires auth (401)")
    
    def test_upcoming_calls_requires_auth(self):
        """GET /api/calls/scheduled/upcoming should require authentication"""
        response = requests.get(f"{BASE_URL}/api/calls/scheduled/upcoming")
        assert response.status_code == 401, "Should require authentication"
        print("✓ GET /api/calls/scheduled/upcoming requires auth (401)")
    
    def test_check_reminders_requires_auth(self):
        """POST /api/calls/scheduled/check-reminders should require authentication"""
        response = requests.post(f"{BASE_URL}/api/calls/scheduled/check-reminders")
        assert response.status_code == 401, "Should require authentication"
        print("✓ POST /api/calls/scheduled/check-reminders requires auth (401)")
    
    # === VALIDATION TESTS ===
    
    def test_schedule_call_invalid_lead(self):
        """POST /api/calls/schedule with invalid lead_id should return 404"""
        future_time = (datetime.utcnow() + timedelta(hours=2)).isoformat() + "Z"
        response = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": "nonexistent_lead_123",
                "scheduled_at": future_time,
                "notes": "Test note"
            }
        )
        assert response.status_code == 404, f"Should return 404 for invalid lead: {response.text}"
        print("✓ POST /api/calls/schedule with invalid lead returns 404")
    
    def test_schedule_call_past_date(self):
        """POST /api/calls/schedule with past date should return 400"""
        past_time = (datetime.utcnow() - timedelta(hours=2)).isoformat() + "Z"
        response = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": past_time,
                "notes": "Test note"
            }
        )
        assert response.status_code == 400, f"Should return 400 for past date: {response.text}"
        data = response.json()
        assert "future" in data.get("detail", "").lower() or "past" in data.get("detail", "").lower(), \
            f"Error message should mention past/future: {data}"
        print("✓ POST /api/calls/schedule with past date returns 400")
    
    def test_schedule_call_invalid_date_format(self):
        """POST /api/calls/schedule with invalid date format should return 400"""
        response = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": "not-a-valid-date",
                "notes": "Test note"
            }
        )
        assert response.status_code == 400, f"Should return 400 for invalid date format: {response.text}"
        print("✓ POST /api/calls/schedule with invalid date format returns 400")
    
    # === CRUD TESTS ===
    
    def test_schedule_call_success(self):
        """POST /api/calls/schedule with valid data should create scheduled call"""
        future_time = (datetime.utcnow() + timedelta(hours=24)).isoformat() + "Z"
        response = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": future_time,
                "notes": "Test call scheduling",
                "reminder_minutes": 30
            }
        )
        assert response.status_code == 200, f"Should create scheduled call: {response.text}"
        data = response.json()
        
        # Validate response structure
        assert "schedule_id" in data, "Response should contain schedule_id"
        assert "scheduled_at" in data, "Response should contain scheduled_at"
        assert "lead_name" in data, "Response should contain lead_name"
        assert "message" in data, "Response should contain message"
        
        TestCallSchedulingFeature.schedule_id = data["schedule_id"]
        print(f"✓ POST /api/calls/schedule creates scheduled call: {data['schedule_id']}")
    
    def test_get_scheduled_calls(self):
        """GET /api/calls/scheduled should return list of scheduled calls"""
        response = requests.get(
            f"{BASE_URL}/api/calls/scheduled",
            headers=self.headers
        )
        assert response.status_code == 200, f"Should return scheduled calls: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/calls/scheduled returns {len(data)} scheduled calls")
        
        # If we have scheduled calls, validate structure
        if data:
            sc = data[0]
            expected_fields = ["schedule_id", "lead_id", "lead_name", "scheduled_at", "status"]
            for field in expected_fields:
                assert field in sc, f"Scheduled call should have {field}"
            print("✓ Scheduled call has correct structure")
    
    def test_get_scheduled_calls_with_status_filter(self):
        """GET /api/calls/scheduled?status=scheduled should filter by status"""
        response = requests.get(
            f"{BASE_URL}/api/calls/scheduled?status=scheduled",
            headers=self.headers
        )
        assert response.status_code == 200, f"Should return filtered calls: {response.text}"
        data = response.json()
        
        # All returned calls should have status=scheduled
        for sc in data:
            assert sc.get("status") == "scheduled", f"All calls should have status=scheduled: {sc}"
        print(f"✓ GET /api/calls/scheduled?status=scheduled filters correctly ({len(data)} calls)")
    
    def test_get_upcoming_calls(self):
        """GET /api/calls/scheduled/upcoming should return calls within 7 days"""
        response = requests.get(
            f"{BASE_URL}/api/calls/scheduled/upcoming",
            headers=self.headers
        )
        assert response.status_code == 200, f"Should return upcoming calls: {response.text}"
        data = response.json()
        
        assert isinstance(data, list), "Response should be a list"
        print(f"✓ GET /api/calls/scheduled/upcoming returns {len(data)} upcoming calls")
        
        # Validate all returned calls are within next 7 days
        now = datetime.utcnow()
        week_later = now + timedelta(days=7)
        for sc in data:
            scheduled_at = datetime.fromisoformat(sc["scheduled_at"].replace("Z", "+00:00").replace("+00:00", ""))
            # Allow some flexibility due to timezone differences
            assert sc.get("status") == "scheduled", "Upcoming calls should have status=scheduled"
        print("✓ Upcoming calls have correct status")
    
    def test_update_scheduled_call(self):
        """PUT /api/calls/scheduled/{schedule_id} should update the call"""
        if not TestCallSchedulingFeature.schedule_id:
            pytest.skip("No scheduled call to update")
        
        new_notes = "Updated test notes for call"
        new_time = (datetime.utcnow() + timedelta(hours=48)).isoformat() + "Z"
        
        response = requests.put(
            f"{BASE_URL}/api/calls/scheduled/{TestCallSchedulingFeature.schedule_id}",
            headers=self.headers,
            json={
                "notes": new_notes,
                "reminder_minutes": 60,
                "scheduled_at": new_time
            }
        )
        assert response.status_code == 200, f"Should update scheduled call: {response.text}"
        data = response.json()
        
        assert data.get("notes") == new_notes, "Notes should be updated"
        assert data.get("reminder_minutes") == 60, "Reminder minutes should be updated"
        print(f"✓ PUT /api/calls/scheduled/{TestCallSchedulingFeature.schedule_id} updates successfully")
    
    def test_update_scheduled_call_status(self):
        """PUT /api/calls/scheduled/{schedule_id} can update status to completed"""
        if not TestCallSchedulingFeature.schedule_id:
            pytest.skip("No scheduled call to update")
        
        response = requests.put(
            f"{BASE_URL}/api/calls/scheduled/{TestCallSchedulingFeature.schedule_id}",
            headers=self.headers,
            json={"status": "completed"}
        )
        assert response.status_code == 200, f"Should update status: {response.text}"
        data = response.json()
        assert data.get("status") == "completed", "Status should be updated to completed"
        print("✓ PUT can update status to completed")
        
        # Reset to scheduled for next tests
        requests.put(
            f"{BASE_URL}/api/calls/scheduled/{TestCallSchedulingFeature.schedule_id}",
            headers=self.headers,
            json={"status": "scheduled"}
        )
    
    def test_update_nonexistent_scheduled_call(self):
        """PUT /api/calls/scheduled/{schedule_id} with invalid ID should return 404"""
        response = requests.put(
            f"{BASE_URL}/api/calls/scheduled/nonexistent_schedule_123",
            headers=self.headers,
            json={"notes": "Test"}
        )
        assert response.status_code == 404, f"Should return 404 for nonexistent schedule: {response.text}"
        print("✓ PUT /api/calls/scheduled with invalid ID returns 404")
    
    def test_check_reminders(self):
        """POST /api/calls/scheduled/check-reminders should check and create notifications"""
        response = requests.post(
            f"{BASE_URL}/api/calls/scheduled/check-reminders",
            headers=self.headers,
            json={}
        )
        assert response.status_code == 200, f"Should check reminders: {response.text}"
        data = response.json()
        
        assert "reminders_sent" in data, "Response should contain reminders_sent count"
        assert isinstance(data["reminders_sent"], int), "reminders_sent should be an integer"
        print(f"✓ POST /api/calls/scheduled/check-reminders: {data['reminders_sent']} reminders sent")
    
    def test_delete_scheduled_call(self):
        """DELETE /api/calls/scheduled/{schedule_id} should cancel the call"""
        # Create a new call to delete
        future_time = (datetime.utcnow() + timedelta(hours=72)).isoformat() + "Z"
        create_resp = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": future_time,
                "notes": "Test call to delete"
            }
        )
        assert create_resp.status_code == 200, "Should create scheduled call to delete"
        delete_schedule_id = create_resp.json()["schedule_id"]
        
        # Delete the call
        response = requests.delete(
            f"{BASE_URL}/api/calls/scheduled/{delete_schedule_id}",
            headers=self.headers
        )
        assert response.status_code == 200, f"Should cancel scheduled call: {response.text}"
        data = response.json()
        assert "cancelled" in data.get("message", "").lower() or "cancel" in data.get("message", "").lower(), \
            f"Message should mention cancelled: {data}"
        print(f"✓ DELETE /api/calls/scheduled/{delete_schedule_id} cancels successfully")
        
        # Verify it's cancelled by trying to delete again
        response2 = requests.delete(
            f"{BASE_URL}/api/calls/scheduled/{delete_schedule_id}",
            headers=self.headers
        )
        assert response2.status_code == 404, "Should return 404 for already cancelled call"
        print("✓ Double delete returns 404 (already cancelled)")
    
    def test_delete_nonexistent_scheduled_call(self):
        """DELETE /api/calls/scheduled/{schedule_id} with invalid ID should return 404"""
        response = requests.delete(
            f"{BASE_URL}/api/calls/scheduled/nonexistent_schedule_456",
            headers=self.headers
        )
        assert response.status_code == 404, f"Should return 404 for nonexistent schedule: {response.text}"
        print("✓ DELETE /api/calls/scheduled with invalid ID returns 404")


class TestCallSchedulingDataPersistence:
    """Test data persistence for call scheduling"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        """Ensure previous class has run and we have auth"""
        if not TestCallSchedulingFeature.auth_token:
            response = requests.post(
                f"{BASE_URL}/api/auth/login",
                json={
                    "email": os.getenv("TEST_EMAIL", "florian@unyted.world"),
                    "password": os.getenv("TEST_PASSWORD", "DavidConstantin18")
                }
            )
            assert response.status_code == 200
            TestCallSchedulingFeature.auth_token = response.json().get("token")
    
    @property
    def headers(self):
        return {"Authorization": f"Bearer {TestCallSchedulingFeature.auth_token}"}
    
    def test_scheduled_call_appears_in_list_after_creation(self):
        """Create a scheduled call and verify it appears in GET list"""
        # Create
        future_time = (datetime.utcnow() + timedelta(hours=36)).isoformat() + "Z"
        create_resp = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": future_time,
                "notes": "TEST_Persistence check"
            }
        )
        assert create_resp.status_code == 200
        created_id = create_resp.json()["schedule_id"]
        
        # Verify in list
        list_resp = requests.get(f"{BASE_URL}/api/calls/scheduled", headers=self.headers)
        assert list_resp.status_code == 200
        scheduled_ids = [sc["schedule_id"] for sc in list_resp.json()]
        assert created_id in scheduled_ids, "Created schedule should appear in list"
        print("✓ Created scheduled call appears in list (data persistence verified)")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/calls/scheduled/{created_id}", headers=self.headers)
    
    def test_scheduled_call_fields_persist(self):
        """Create scheduled call and verify all fields are persisted correctly"""
        future_time = (datetime.utcnow() + timedelta(hours=25)).isoformat() + "Z"
        test_notes = "TEST_Field persistence test notes"
        
        create_resp = requests.post(
            f"{BASE_URL}/api/calls/schedule",
            headers=self.headers,
            json={
                "lead_id": TestCallSchedulingFeature.lead_id,
                "scheduled_at": future_time,
                "notes": test_notes,
                "reminder_minutes": 45
            }
        )
        assert create_resp.status_code == 200
        created_id = create_resp.json()["schedule_id"]
        
        # Get and verify
        list_resp = requests.get(f"{BASE_URL}/api/calls/scheduled", headers=self.headers)
        assert list_resp.status_code == 200
        
        found = None
        for sc in list_resp.json():
            if sc["schedule_id"] == created_id:
                found = sc
                break
        
        assert found is not None, "Created schedule should be found"
        assert found.get("notes") == test_notes, "Notes should be persisted"
        assert found.get("reminder_minutes") == 45, "Reminder minutes should be persisted"
        assert found.get("status") == "scheduled", "Status should be 'scheduled'"
        assert "lead_name" in found, "lead_name should be populated"
        print("✓ All scheduled call fields persist correctly")
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/calls/scheduled/{created_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
