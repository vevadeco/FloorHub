import requests
import json
import sys
from datetime import datetime, date

class FlooringStoreAPITester:
    def __init__(self, base_url="https://flooring-hub-8.preview.emergentagent.com/api"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.user_role = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_test(self, name, success, details="", error=""):
        """Log test results"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test": name,
            "success": success,
            "details": details,
            "error": error,
            "timestamp": datetime.now().isoformat()
        }
        self.test_results.append(result)
        
        status = "✅ PASSED" if success else "❌ FAILED"
        print(f"{status} - {name}")
        if details:
            print(f"   Details: {details}")
        if error:
            print(f"   Error: {error}")

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        
        if headers:
            test_headers.update(headers)

        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            details = f"Status: {response.status_code}"
            error = ""
            
            if not success:
                error = f"Expected {expected_status}, got {response.status_code}"
                try:
                    error_data = response.json()
                    if 'detail' in error_data:
                        error += f" - {error_data['detail']}"
                except:
                    pass

            self.log_test(name, success, details, error)
            
            return success, response.json() if response.text and success else {}

        except Exception as e:
            self.log_test(name, False, "", str(e))
            return False, {}

    def test_register(self):
        """Test user registration"""
        test_email = f"owner_test_{datetime.now().strftime('%H%M%S')}@test.com"
        success, response = self.run_test(
            "User Registration (First user becomes owner)",
            "POST",
            "/auth/register",
            200,
            data={
                "name": "Test Owner",
                "email": test_email,
                "password": "TestPass123!"
            }
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.user_role = response['user']['role']
            self.log_test("Token received", True, f"Role: {self.user_role}")
            return True
        return False

    def test_login(self, email, password):
        """Test user login"""
        success, response = self.run_test(
            "User Login",
            "POST",
            "/auth/login",
            200,
            data={"email": email, "password": password}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.user_id = response['user']['id']
            self.user_role = response['user']['role']
            return True
        return False

    def test_get_me(self):
        """Test get current user info"""
        success, response = self.run_test(
            "Get Current User Info",
            "GET", 
            "/auth/me",
            200
        )
        return success

    def test_product_crud(self):
        """Test product CRUD operations"""
        # Create product
        product_data = {
            "name": "Test Oak Hardwood",
            "sku": "TEST-OAK-001",
            "category": "Hardwood",
            "cost_price": 45.00,
            "selling_price": 75.00,
            "sqft_per_box": 20.0,
            "stock_boxes": 100,
            "description": "Test product",
            "supplier": "Test Supplier"
        }
        
        success, product = self.run_test(
            "Create Product",
            "POST",
            "/products",
            200,
            data=product_data
        )
        
        if not success:
            return False
            
        product_id = product.get('id')
        if not product_id:
            self.log_test("Product ID missing", False, "", "No ID in response")
            return False

        # Get products
        success, products = self.run_test(
            "Get Products List",
            "GET",
            "/products",
            200
        )
        
        if success:
            product_found = any(p.get('id') == product_id for p in products)
            self.log_test("Product in list", product_found, f"Found {len(products)} products")

        # Get single product
        success, _ = self.run_test(
            "Get Single Product",
            "GET",
            f"/products/{product_id}",
            200
        )

        # Update product
        update_data = product_data.copy()
        update_data['name'] = "Updated Test Oak"
        success, _ = self.run_test(
            "Update Product",
            "PUT",
            f"/products/{product_id}",
            200,
            data=update_data
        )

        return product_id

    def test_customer_crud(self):
        """Test customer CRUD operations"""
        customer_data = {
            "name": "Test Customer",
            "email": "testcustomer@test.com",
            "phone": "555-123-4567",
            "address": "123 Test St",
            "city": "Test City",
            "state": "TS",
            "zip_code": "12345"
        }
        
        success, customer = self.run_test(
            "Create Customer",
            "POST",
            "/customers",
            200,
            data=customer_data
        )
        
        if success:
            customer_id = customer.get('id')
            
            # Get customers
            self.run_test(
                "Get Customers List",
                "GET",
                "/customers",
                200
            )
            
            # Get single customer
            self.run_test(
                "Get Single Customer",
                "GET",
                f"/customers/{customer_id}",
                200
            )
            
            return customer_id
        return None

    def test_invoice_crud(self, product_id, customer_id):
        """Test invoice CRUD operations with sq ft to boxes conversion"""
        invoice_data = {
            "customer_id": customer_id or "test-customer-123",
            "customer_name": "Test Customer",
            "customer_email": "test@test.com",
            "customer_phone": "555-123-4567",
            "customer_address": "123 Test St",
            "items": [
                {
                    "product_id": product_id or "test-product-123",
                    "product_name": "Test Oak Hardwood",
                    "sqft_needed": 150.0,
                    "sqft_per_box": 20.0,
                    "boxes_needed": 8,  # 150/20 = 7.5, rounded up to 8
                    "unit_price": 75.00,
                    "total_price": 600.00  # 8 * 75
                }
            ],
            "subtotal": 600.00,
            "tax_rate": 8.25,
            "tax_amount": 49.50,
            "discount": 0.0,
            "total": 649.50,
            "notes": "Test invoice",
            "status": "draft",
            "is_estimate": False
        }
        
        success, invoice = self.run_test(
            "Create Invoice (with sq ft conversion)",
            "POST",
            "/invoices",
            200,
            data=invoice_data
        )
        
        if success:
            invoice_id = invoice.get('id')
            
            # Test estimate creation
            estimate_data = invoice_data.copy()
            estimate_data['is_estimate'] = True
            success, estimate = self.run_test(
                "Create Estimate",
                "POST",
                "/invoices",
                200,
                data=estimate_data
            )
            
            # Get invoices
            self.run_test(
                "Get Invoices",
                "GET",
                "/invoices?is_estimate=false",
                200
            )
            
            # Get estimates
            self.run_test(
                "Get Estimates", 
                "GET",
                "/invoices?is_estimate=true",
                200
            )
            
            # Get invoice PDF
            self.run_test(
                "Get Invoice PDF",
                "GET",
                f"/invoices/{invoice_id}/pdf",
                200
            )
            
            return invoice_id
        return None

    def test_lead_crud(self):
        """Test lead CRUD operations"""
        lead_data = {
            "name": "Test Lead",
            "email": "testlead@test.com", 
            "phone": "555-987-6543",
            "source": "manual",
            "status": "new",
            "project_type": "Residential",
            "estimated_sqft": 500.0,
            "notes": "Interested in hardwood flooring"
        }
        
        success, lead = self.run_test(
            "Create Lead",
            "POST",
            "/leads",
            200,
            data=lead_data
        )
        
        if success:
            lead_id = lead.get('id')
            
            # Get leads
            self.run_test(
                "Get Leads List",
                "GET",
                "/leads",
                200
            )
            
            # Update lead status
            update_data = lead_data.copy()
            update_data['status'] = 'contacted'
            self.run_test(
                "Update Lead Status",
                "PUT",
                f"/leads/{lead_id}",
                200,
                data=update_data
            )
            
            return lead_id
        return None

    def test_expense_crud(self):
        """Test expense CRUD operations"""
        expense_data = {
            "category": "supplier",
            "description": "Test flooring materials",
            "amount": 1250.00,
            "payment_method": "check",
            "reference_number": "CHK-001",
            "vendor_name": "ABC Flooring Supply",
            "date": date.today().isoformat()
        }
        
        success, expense = self.run_test(
            "Create Expense",
            "POST",
            "/expenses",
            200,
            data=expense_data
        )
        
        if success:
            expense_id = expense.get('id')
            
            # Get expenses
            self.run_test(
                "Get Expenses List",
                "GET",
                "/expenses",
                200
            )
            
            return expense_id
        return None

    def test_contractor_crud(self):
        """Test contractor CRUD operations (owner only)"""
        if self.user_role != "owner":
            self.log_test("Skip Contractor Tests", True, "User is not owner")
            return None
            
        contractor_data = {
            "name": "Test Contractor",
            "company": "Test Contracting LLC",
            "phone": "555-111-2222",
            "email": "contractor@test.com",
            "specialty": "Installation",
            "address": "456 Contractor St",
            "notes": "Reliable contractor",
            "rating": 4
        }
        
        success, contractor = self.run_test(
            "Create Contractor",
            "POST",
            "/contractors",
            200,
            data=contractor_data
        )
        
        if success:
            contractor_id = contractor.get('id')
            
            # Get contractors
            self.run_test(
                "Get Contractors List",
                "GET",
                "/contractors",
                200
            )
            
            return contractor_id
        return None

    def test_settings(self):
        """Test settings operations"""
        # Get settings
        success, settings = self.run_test(
            "Get Company Settings",
            "GET",
            "/settings",
            200
        )
        
        if self.user_role == "owner":
            settings_data = {
                "company_name": "Test Flooring Store",
                "company_address": "123 Business Ave",
                "company_phone": "555-999-8888",
                "company_email": "info@testflooring.com",
                "tax_rate": 8.25,
                "facebook_api_token": "",
                "facebook_page_id": ""
            }
            
            self.run_test(
                "Update Company Settings",
                "PUT",
                "/settings",
                200,
                data=settings_data
            )
        else:
            self.log_test("Skip Settings Update", True, "User is not owner")

    def test_dashboard_stats(self):
        """Test dashboard statistics"""
        self.run_test(
            "Get Dashboard Stats",
            "GET",
            "/dashboard/stats",
            200
        )

    def test_payment_flow(self, invoice_id):
        """Test payment functionality (basic checks)"""
        if not invoice_id:
            self.log_test("Skip Payment Tests", True, "No invoice ID available")
            return
            
        # Test checkout creation (will fail if Stripe not configured properly)
        success, _ = self.run_test(
            "Create Stripe Checkout Session",
            "POST",
            f"/payments/checkout?invoice_id={invoice_id}",
            200,
            data={}
        )
        
        # Test get transactions
        self.run_test(
            "Get Payment Transactions",
            "GET", 
            "/payments/transactions",
            200
        )

def main():
    print("🚀 Starting Flooring Store API Tests...")
    print("=" * 50)
    
    tester = FlooringStoreAPITester()
    
    # Test registration (creates owner)
    if not tester.test_register():
        print("❌ Registration failed, stopping tests")
        return 1

    print(f"\n👤 Registered as: {tester.user_role}")
    
    # Test authentication flow
    tester.test_get_me()
    
    # Test core functionality
    print("\n📦 Testing Products...")
    product_id = tester.test_product_crud()
    
    print("\n👥 Testing Customers...")
    customer_id = tester.test_customer_crud()
    
    print("\n📄 Testing Invoices...")
    invoice_id = tester.test_invoice_crud(product_id, customer_id)
    
    print("\n🎯 Testing Leads...")
    lead_id = tester.test_lead_crud()
    
    print("\n💰 Testing Expenses...")
    expense_id = tester.test_expense_crud()
    
    print("\n🔧 Testing Contractors...")
    contractor_id = tester.test_contractor_crud()
    
    print("\n⚙️ Testing Settings...")
    tester.test_settings()
    
    print("\n📊 Testing Dashboard...")
    tester.test_dashboard_stats()
    
    print("\n💳 Testing Payments...")
    tester.test_payment_flow(invoice_id)

    # Print summary
    print("\n" + "=" * 50)
    print(f"📊 TEST SUMMARY")
    print("=" * 50)
    print(f"Tests Run: {tester.tests_run}")
    print(f"Tests Passed: {tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed/tester.tests_run*100):.1f}%")
    
    # Show failed tests
    failed_tests = [t for t in tester.test_results if not t['success']]
    if failed_tests:
        print(f"\n❌ FAILED TESTS ({len(failed_tests)}):")
        for test in failed_tests:
            print(f"  • {test['test']}: {test['error']}")
    
    # Save results
    with open('/tmp/backend_test_results.json', 'w') as f:
        json.dump({
            "summary": {
                "total_tests": tester.tests_run,
                "passed_tests": tester.tests_passed,
                "success_rate": tester.tests_passed/tester.tests_run*100 if tester.tests_run > 0 else 0
            },
            "test_results": tester.test_results
        }, f, indent=2)
    
    return 0 if tester.tests_passed == tester.tests_run else 1

if __name__ == "__main__":
    sys.exit(main())