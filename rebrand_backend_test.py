import requests
import sys
from datetime import datetime

class RebrandTester:
    def __init__(self, base_url="https://earnrm-preview.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

    def run_test(self, name, method, endpoint, expected_status, data=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    return success, response.json()
                except:
                    return success, response.text
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

    def test_api_root_branding(self):
        """Test that API root returns 'earnrm CRM API'"""
        success, response = self.run_test(
            "API Root Branding Check",
            "GET",
            "api/",
            200
        )
        if success:
            if isinstance(response, dict):
                title = response.get('title', '')
                if 'earnrm CRM API' in title:
                    print(f"   ✅ API title contains 'earnrm CRM API': {title}")
                    return True
                else:
                    print(f"   ❌ API title does not contain 'earnrm CRM API': {title}")
                    return False
            elif isinstance(response, str):
                if 'earnrm CRM API' in response:
                    print(f"   ✅ API response contains 'earnrm CRM API'")
                    return True
                else:
                    print(f"   ❌ API response does not contain 'earnrm CRM API'")
                    return False
        return False

    def test_login_functionality(self):
        """Test login with provided credentials"""
        success, response = self.run_test(
            "Login Test",
            "POST",
            "api/auth/login",
            200,
            data={"email": "florian@unyted.world", "password": "DavidConstantin18"}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   ✅ Login successful, token obtained")
            return True
        return False

    def test_api_endpoints_accessible(self):
        """Test that key API endpoints are accessible"""
        endpoints_to_test = [
            ("Organizations Current", "api/organizations/current", 200),
            ("Auth Me", "api/auth/me", 200),
            ("Leads", "api/leads", 200),
            ("Deals", "api/deals", 200),
            ("Tasks", "api/tasks", 200),
            ("Companies", "api/companies", 200),
            ("Campaigns", "api/campaigns", 200)
        ]
        
        all_passed = True
        for name, endpoint, expected_status in endpoints_to_test:
            success, _ = self.run_test(name, "GET", endpoint, expected_status)
            if not success:
                all_passed = False
        
        return all_passed

def main():
    print("🚀 Testing earnrm Rebrand - Backend API")
    print("=" * 50)
    
    tester = RebrandTester()
    
    # Test 1: API Root Branding
    print("\n🔧 Testing API Branding")
    print("-" * 30)
    api_branding_success = tester.test_api_root_branding()
    
    # Test 2: Login functionality
    print("\n🔧 Testing Login")
    print("-" * 30)
    login_success = tester.test_login_functionality()
    
    # Test 3: API endpoints accessibility
    if login_success:
        print("\n🔧 Testing API Endpoints")
        print("-" * 30)
        endpoints_success = tester.test_api_endpoints_accessible()
    else:
        endpoints_success = False
        print("\n⚠️ Skipping endpoint tests due to login failure")

    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Tests completed: {tester.tests_passed}/{tester.tests_run}")
    
    if tester.failed_tests:
        print("\n❌ Failed tests:")
        for failure in tester.failed_tests:
            print(f"   - {failure.get('test', 'Unknown')}: {failure}")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"✅ Success rate: {success_rate:.1f}%")
    
    # Summary of rebrand verification
    print("\n🎯 Rebrand Verification Summary:")
    print(f"   API Branding: {'✅ PASS' if api_branding_success else '❌ FAIL'}")
    print(f"   Login System: {'✅ PASS' if login_success else '❌ FAIL'}")
    print(f"   API Endpoints: {'✅ PASS' if endpoints_success else '❌ FAIL'}")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())