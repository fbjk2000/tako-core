import requests
import sys
import json
from datetime import datetime

class CRMTester:
    def __init__(self, base_url="https://earnrm-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_info = None
        self.organization_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        
        # Test data storage for data isolation testing
        self.super_admin_data = {}
        self.test_user_data = {}

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, {}
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.failed_tests.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "response": response.text[:200]
                })
                return False, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.failed_tests.append({
                "test": name,
                "error": str(e)
            })
            return False, {}

    def test_super_admin_login(self):
        """Test super admin login"""
        success, response = self.run_test(
            "Super Admin Login",
            "POST",
            "api/auth/login",
            200,
            data={"email": "florian@unyted.world", "password": "DavidConstantin18"}
        )
        if success and 'token' in response:
            self.token = response['token']
            self.user_info = response
            self.organization_id = response.get('organization_id')
            print(f"   Super admin role: {response.get('role', 'Not set')}")
            print(f"   Organization ID: {self.organization_id}")
            # Store super admin data
            self.super_admin_data = {
                'token': self.token,
                'user_info': response,
                'organization_id': self.organization_id
            }
            return True
        return False

    def test_regular_user_registration(self):
        """Test regular user registration with new organization"""
        timestamp = datetime.now().strftime('%H%M%S')
        success, response = self.run_test(
            "Regular User Registration",
            "POST",
            "api/auth/register",
            200,
            data={
                "email": f"testuser{timestamp}@testorg.com",
                "password": "TestPassword123",
                "name": f"Test User {timestamp}",
                "organization_name": f"Test Organization {timestamp}"
            }
        )
        if success and 'token' in response:
            print(f"   Created user: {response.get('name')}")
            print(f"   Organization: {response.get('organization_id')}")
            print(f"   Role: {response.get('role', 'Not set')}")
            # Store test user data
            self.test_user_data = {
                'token': response['token'],
                'user_info': response,
                'organization_id': response.get('organization_id'),
                'email': f"testuser{timestamp}@testorg.com",
                'password': "TestPassword123"
            }
            return True
        return False

    def test_regular_user_login(self):
        """Test regular user login"""
        if not self.test_user_data.get('email'):
            print("   No test user created, skipping login test")
            return False
            
        success, response = self.run_test(
            "Regular User Login",
            "POST",
            "api/auth/login",
            200,
            data={
                "email": self.test_user_data['email'],
                "password": self.test_user_data['password']
            }
        )
        if success and 'token' in response:
            print(f"   Login successful for: {response.get('name')}")
            print(f"   Role: {response.get('role', 'Not set')}")
            # Update test user data with fresh token
            self.test_user_data['token'] = response['token']
            self.test_user_data['user_info'] = response
            return True
        return False

    def switch_to_user(self, user_type="super_admin"):
        """Switch context to different user"""
        if user_type == "super_admin":
            data = self.super_admin_data
        elif user_type == "test_user":
            data = self.test_user_data
        else:
            return False
            
        if not data.get('token'):
            return False
            
        self.token = data['token']
        self.user_info = data['user_info']
        self.organization_id = data['organization_id']
        return True

    # ==================== CRM FUNCTIONALITY TESTS ====================
    
    def test_lead_creation(self, user_type="super_admin"):
        """Test lead creation for different user types"""
        self.switch_to_user(user_type)
        timestamp = datetime.now().strftime('%H%M%S')
        
        lead_data = {
            "first_name": f"John{timestamp}",
            "last_name": f"Doe{timestamp}",
            "email": f"john.doe{timestamp}@example.com",
            "phone": "+1234567890",
            "company": f"Test Company {timestamp}",
            "job_title": "CEO",
            "linkedin_url": "https://linkedin.com/in/johndoe",
            "source": "manual",
            "notes": f"Test lead created by {user_type}"
        }
        
        success, response = self.run_test(
            f"Lead Creation ({user_type})",
            "POST",
            "api/leads",
            200,
            data=lead_data
        )
        if success:
            lead_id = response.get('lead_id')
            print(f"   Created lead: {lead_id}")
            print(f"   Organization: {response.get('organization_id')}")
            
            # Store lead data for later tests
            if user_type == "super_admin":
                self.super_admin_data['lead_id'] = lead_id
            else:
                self.test_user_data['lead_id'] = lead_id
            return lead_id
        return None

    def test_lead_listing(self, user_type="super_admin"):
        """Test lead listing - should only see own organization's leads"""
        self.switch_to_user(user_type)
        
        success, response = self.run_test(
            f"Lead Listing ({user_type})",
            "GET",
            "api/leads",
            200
        )
        if success:
            leads = response if isinstance(response, list) else []
            print(f"   Found {len(leads)} leads")
            if leads:
                # Check all leads belong to current organization
                org_ids = set(lead.get('organization_id') for lead in leads)
                print(f"   Organization IDs in results: {org_ids}")
                if len(org_ids) == 1 and list(org_ids)[0] == self.organization_id:
                    print(f"   ✅ Data isolation confirmed - only own org's leads")
                else:
                    print(f"   ❌ Data isolation issue - seeing other org's leads")
            return leads
        return []

    def test_lead_update(self, user_type="super_admin"):
        """Test lead update"""
        self.switch_to_user(user_type)
        
        # Get lead ID for this user
        lead_id = None
        if user_type == "super_admin":
            lead_id = self.super_admin_data.get('lead_id')
        else:
            lead_id = self.test_user_data.get('lead_id')
            
        if not lead_id:
            print(f"   No lead ID available for {user_type}")
            return False
            
        update_data = {
            "status": "contacted",
            "notes": f"Updated by {user_type} at {datetime.now().isoformat()}"
        }
        
        success, response = self.run_test(
            f"Lead Update ({user_type})",
            "PUT",
            f"api/leads/{lead_id}",
            200,
            data=update_data
        )
        if success:
            print(f"   Updated lead status: {response.get('status')}")
            return True
        return False

    def test_deal_creation(self, user_type="super_admin"):
        """Test deal creation"""
        self.switch_to_user(user_type)
        timestamp = datetime.now().strftime('%H%M%S')
        
        deal_data = {
            "name": f"Test Deal {timestamp}",
            "value": 5000.0,
            "currency": "EUR",
            "stage": "lead",
            "probability": 20,
            "notes": f"Test deal created by {user_type}",
            "task_title": f"Initial contact for deal {timestamp}",
            "task_owner_id": self.user_info.get('user_id'),
            "task_description": "Follow up with prospect"
        }
        
        success, response = self.run_test(
            f"Deal Creation ({user_type})",
            "POST",
            "api/deals",
            200,
            data=deal_data
        )
        if success:
            deal_id = response.get('deal_id')
            print(f"   Created deal: {deal_id}")
            print(f"   Created task: {response.get('created_task_id')}")
            
            # Store deal data
            if user_type == "super_admin":
                self.super_admin_data['deal_id'] = deal_id
            else:
                self.test_user_data['deal_id'] = deal_id
            return deal_id
        return None

    def test_deal_listing(self, user_type="super_admin"):
        """Test deal listing - should only see own organization's deals"""
        self.switch_to_user(user_type)
        
        success, response = self.run_test(
            f"Deal Listing ({user_type})",
            "GET",
            "api/deals",
            200
        )
        if success:
            deals = response if isinstance(response, list) else []
            print(f"   Found {len(deals)} deals")
            if deals:
                # Check data isolation
                org_ids = set(deal.get('organization_id') for deal in deals)
                print(f"   Organization IDs in results: {org_ids}")
                if len(org_ids) == 1 and list(org_ids)[0] == self.organization_id:
                    print(f"   ✅ Data isolation confirmed - only own org's deals")
                else:
                    print(f"   ❌ Data isolation issue - seeing other org's deals")
            return deals
        return []

    def test_task_creation(self, user_type="super_admin"):
        """Test task creation"""
        self.switch_to_user(user_type)
        timestamp = datetime.now().strftime('%H%M%S')
        
        task_data = {
            "title": f"Test Task {timestamp}",
            "description": f"Test task created by {user_type}",
            "status": "todo",
            "priority": "medium",
            "assigned_to": self.user_info.get('user_id')
        }
        
        success, response = self.run_test(
            f"Task Creation ({user_type})",
            "POST",
            "api/tasks",
            200,
            data=task_data
        )
        if success:
            task_id = response.get('task_id')
            print(f"   Created task: {task_id}")
            
            # Store task data
            if user_type == "super_admin":
                self.super_admin_data['task_id'] = task_id
            else:
                self.test_user_data['task_id'] = task_id
            return task_id
        return None

    def test_task_listing(self, user_type="super_admin"):
        """Test task listing - should only see own organization's tasks"""
        self.switch_to_user(user_type)
        
        success, response = self.run_test(
            f"Task Listing ({user_type})",
            "GET",
            "api/tasks",
            200
        )
        if success:
            tasks = response if isinstance(response, list) else []
            print(f"   Found {len(tasks)} tasks")
            if tasks:
                # Check data isolation
                org_ids = set(task.get('organization_id') for task in tasks)
                print(f"   Organization IDs in results: {org_ids}")
                if len(org_ids) == 1 and list(org_ids)[0] == self.organization_id:
                    print(f"   ✅ Data isolation confirmed - only own org's tasks")
                else:
                    print(f"   ❌ Data isolation issue - seeing other org's tasks")
            return tasks
        return []

    def test_company_creation(self, user_type="super_admin"):
        """Test company creation"""
        self.switch_to_user(user_type)
        timestamp = datetime.now().strftime('%H%M%S')
        
        company_data = {
            "name": f"Test Company {timestamp}",
            "industry": "Technology",
            "website": f"https://testcompany{timestamp}.com",
            "size": "50-100",
            "description": f"Test company created by {user_type}"
        }
        
        success, response = self.run_test(
            f"Company Creation ({user_type})",
            "POST",
            "api/companies",
            200,
            data=company_data
        )
        if success:
            company_id = response.get('company_id')
            print(f"   Created company: {company_id}")
            
            # Store company data
            if user_type == "super_admin":
                self.super_admin_data['company_id'] = company_id
            else:
                self.test_user_data['company_id'] = company_id
            return company_id
        return None

    def test_organization_settings_access(self, user_type="super_admin"):
        """Test organization settings access"""
        self.switch_to_user(user_type)
        
        success, response = self.run_test(
            f"Organization Settings Access ({user_type})",
            "GET",
            "api/organizations/settings",
            200
        )
        if success:
            print(f"   Organization: {response.get('name')}")
            print(f"   Deal stages: {len(response.get('deal_stages', []))}")
            print(f"   Task stages: {len(response.get('task_stages', []))}")
            return True
        return False

    def test_data_isolation_cross_org_access(self):
        """Test that users cannot access other organization's data"""
        print("\n🔒 Testing Data Isolation - Cross-Organization Access")
        
        # Try to access super admin's lead with test user token
        self.switch_to_user("test_user")
        super_admin_lead_id = self.super_admin_data.get('lead_id')
        
        if super_admin_lead_id:
            success, response = self.run_test(
                "Cross-Org Lead Access (Should Fail)",
                "GET",
                f"api/leads/{super_admin_lead_id}",
                404  # Should return 404 or 403
            )
            if success:
                print(f"   ✅ Data isolation working - cannot access other org's lead")
            else:
                print(f"   ❌ Data isolation breach - accessed other org's lead")
        
        # Try to access test user's lead with super admin token
        self.switch_to_user("super_admin")
        test_user_lead_id = self.test_user_data.get('lead_id')
        
        if test_user_lead_id:
            success, response = self.run_test(
                "Cross-Org Lead Access as Super Admin",
                "GET",
                f"api/leads/{test_user_lead_id}",
                404  # Super admin should also not see other org's data unless explicitly allowed
            )
            if success:
                print(f"   ✅ Data isolation working - super admin cannot access other org's lead")
            else:
                print(f"   ❌ Data isolation issue - super admin accessed other org's lead")
        
        return True

def main():
    print("🚀 Testing CRM Functionalities - Data Isolation & User Permissions")
    print("=" * 70)
    
    tester = CRMTester()
    
    # Test 1: Super Admin Login
    print("\n👑 Testing Super Admin Login")
    print("-" * 30)
    if not tester.test_super_admin_login():
        print("❌ Super admin login failed - stopping tests")
        return 1

    # Test 2: Regular User Registration & Login
    print("\n👤 Testing Regular User Registration & Login")
    print("-" * 30)
    if not tester.test_regular_user_registration():
        print("❌ User registration failed - stopping tests")
        return 1
    
    if not tester.test_regular_user_login():
        print("❌ User login failed - stopping tests")
        return 1

    # Test 3: Lead Management (Both Users)
    print("\n📋 Testing Lead Management")
    print("-" * 30)
    tester.test_lead_creation("super_admin")
    tester.test_lead_creation("test_user")
    tester.test_lead_listing("super_admin")
    tester.test_lead_listing("test_user")
    tester.test_lead_update("super_admin")
    tester.test_lead_update("test_user")

    # Test 4: Deal Management (Both Users)
    print("\n💼 Testing Deal Management")
    print("-" * 30)
    tester.test_deal_creation("super_admin")
    tester.test_deal_creation("test_user")
    tester.test_deal_listing("super_admin")
    tester.test_deal_listing("test_user")

    # Test 5: Task Management (Both Users)
    print("\n✅ Testing Task Management")
    print("-" * 30)
    tester.test_task_creation("super_admin")
    tester.test_task_creation("test_user")
    tester.test_task_listing("super_admin")
    tester.test_task_listing("test_user")

    # Test 6: Company Management (Both Users)
    print("\n🏢 Testing Company Management")
    print("-" * 30)
    tester.test_company_creation("super_admin")
    tester.test_company_creation("test_user")

    # Test 7: Organization Settings Access (Both Users)
    print("\n⚙️ Testing Organization Settings Access")
    print("-" * 30)
    tester.test_organization_settings_access("super_admin")
    tester.test_organization_settings_access("test_user")

    # Test 8: Data Isolation
    print("\n🔒 Testing Data Isolation")
    print("-" * 30)
    tester.test_data_isolation_cross_org_access()

    # Print results
    print("\n" + "=" * 70)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failed_tests:
        print("\n❌ Failed tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure.get('test', 'Unknown')}: {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"✅ Success rate: {success_rate:.1f}%")
    
    # Summary for main agent
    print(f"\n📋 SUMMARY FOR MAIN AGENT:")
    print(f"   - Super Admin Login: {'✅' if tester.super_admin_data.get('token') else '❌'}")
    print(f"   - Regular User Registration: {'✅' if tester.test_user_data.get('token') else '❌'}")
    print(f"   - Lead Creation (Both Users): {'✅' if tester.super_admin_data.get('lead_id') and tester.test_user_data.get('lead_id') else '❌'}")
    print(f"   - Deal Creation (Both Users): {'✅' if tester.super_admin_data.get('deal_id') and tester.test_user_data.get('deal_id') else '❌'}")
    print(f"   - Task Creation (Both Users): {'✅' if tester.super_admin_data.get('task_id') and tester.test_user_data.get('task_id') else '❌'}")
    print(f"   - Company Creation (Both Users): {'✅' if tester.super_admin_data.get('company_id') and tester.test_user_data.get('company_id') else '❌'}")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())