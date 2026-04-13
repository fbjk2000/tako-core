#!/usr/bin/env python3
import socket
import resend

print("=" * 50)
print("  UPMUCH.COM STATUS CHECK")
print("=" * 50)

# DNS Check
print("\n📡 DNS Status:")
try:
    ip = socket.gethostbyname('upmuch.com')
    if ip == '34.107.197.154':
        print(f"  ✅ upmuch.com → {ip} (CORRECT)")
    else:
        print(f"  ⏳ upmuch.com → {ip} (still propagating, need 34.107.197.154)")
except Exception as e:
    print(f"  ❌ Error: {e}")

# Resend Check
print("\n📧 Resend Email Status:")
resend.api_key = "re_fruiYkub_Ai4wWQMvRm6zh1Lu4ruG5Jsh"
try:
    domain = resend.Domains.get("da0a2ab4-7047-4093-bacb-43d3bfdf652c")
    status = domain.get('status')
    icon = "✅" if status == 'verified' else "⏳"
    print(f"  {icon} Domain: {domain.get('name')} - {status}")
except Exception as e:
    print(f"  ❌ Error: {e}")

print("\n" + "=" * 50)
