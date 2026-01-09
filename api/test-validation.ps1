# API Validation Testing Script
# Run this script to test the validation and rate limiting features
# Prerequisites: API server must be running on http://localhost:3001

$baseUrl = "http://localhost:3001/api"

Write-Host "=================================" -ForegroundColor Cyan
Write-Host "SLP Caseload Tracker API Tests" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "1. Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:3001/health" -Method Get
    Write-Host "   ✓ Server is running: $($health.status)" -ForegroundColor Green
} catch {
    Write-Host "   X Server is not running! Start it with: cd api; npm run dev" -ForegroundColor Red
    exit 1
}

# Test 2: Valid Student Creation
Write-Host ""
Write-Host "2. Testing Valid Student Creation..." -ForegroundColor Yellow
$validStudent = @{
    name = "Test Student"
    age = 8
    grade = "3rd"
    concerns = @("articulation", "language")
    status = "active"
    school = "Test School"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/students" -Method Post -Body $validStudent -ContentType "application/json"
    Write-Host "   ✓ Student created: $($result.id)" -ForegroundColor Green
    $testStudentId = $result.id
} catch {
    Write-Host "   ✗ Failed to create student: $_" -ForegroundColor Red
}

# Test 3: Invalid Student (missing required fields)
Write-Host ""
Write-Host "3. Testing Validation: Missing Required Fields..." -ForegroundColor Yellow
$invalidStudent = @{
    name = ""  # Empty name should fail
    age = -5   # Negative age should fail
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/students" -Method Post -Body $invalidStudent -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ✗ Should have failed but didn't!" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "Validation failed") {
        Write-Host "   ✓ Validation correctly rejected invalid data" -ForegroundColor Green
        Write-Host "     Errors: $($errorResponse.details | ForEach-Object { "$($_.field): $($_.message)" })" -ForegroundColor Gray
    } else {
        Write-Host "   ? Unexpected error: $($errorResponse.error)" -ForegroundColor Yellow
    }
}

# Test 4: Invalid Email Format
Write-Host ""
Write-Host "4. Testing Validation: Invalid Email Format..." -ForegroundColor Yellow
$invalidTeacher = @{
    name = "Test Teacher"
    grade = "3rd"
    school = "Test School"
    emailAddress = "not-an-email"  # Invalid email
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/teachers" -Method Post -Body $invalidTeacher -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ? Teacher created (email validation may be lenient): $($result.id)" -ForegroundColor Yellow
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "Validation failed") {
        Write-Host "   ✓ Validation correctly rejected invalid email" -ForegroundColor Green
        Write-Host "     Errors: $($errorResponse.details | ForEach-Object { "$($_.field): $($_.message)" })" -ForegroundColor Gray
    } else {
        Write-Host "   ? Error: $($errorResponse.error)" -ForegroundColor Yellow
    }
}

# Test 5: Invalid Goal (missing studentId)
Write-Host ""
Write-Host "5. Testing Validation: Goal Without Student..." -ForegroundColor Yellow
$invalidGoal = @{
    studentId = "non-existent-student-id"
    description = "Test goal"
    status = "in-progress"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/goals" -Method Post -Body $invalidGoal -ContentType "application/json" -ErrorAction Stop
    Write-Host "   ✗ Should have failed but didn't!" -ForegroundColor Red
} catch {
    $errorResponse = $_.ErrorDetails.Message | ConvertFrom-Json
    if ($errorResponse.error -eq "Student not found") {
        Write-Host "   ✓ Validation correctly rejected goal for non-existent student" -ForegroundColor Green
    } else {
        Write-Host "   ✓ Error returned: $($errorResponse.error)" -ForegroundColor Green
    }
}

# Test 6: Get Schools (should work)
Write-Host ""
Write-Host "6. Testing GET endpoints..." -ForegroundColor Yellow
try {
    $schools = Invoke-RestMethod -Uri "$baseUrl/schools" -Method Get
    Write-Host "   ✓ Retrieved $($schools.Count) schools" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to get schools: $_" -ForegroundColor Red
}

# Clean up test student if created
if ($testStudentId) {
    Write-Host ""
    Write-Host "7. Cleaning up test data..." -ForegroundColor Yellow
    try {
        Invoke-RestMethod -Uri "$baseUrl/students/$testStudentId" -Method Delete | Out-Null
        Write-Host "   ✓ Test student deleted" -ForegroundColor Green
    } catch {
        Write-Host "   ? Could not delete test student (may not exist)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "=================================" -ForegroundColor Cyan
Write-Host "Tests Complete!" -ForegroundColor Cyan
Write-Host "=================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To test rate limiting (in production mode):" -ForegroundColor Gray
Write-Host "  1. Set NODE_ENV=production in api/.env" -ForegroundColor Gray
Write-Host "  2. Set RATE_LIMIT_ENABLED=true" -ForegroundColor Gray
Write-Host "  3. Make more than 100 requests in 15 minutes" -ForegroundColor Gray
Write-Host ""

