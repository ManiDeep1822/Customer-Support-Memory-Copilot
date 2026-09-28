import asyncio
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

from backend.routes.tickets import get_ticket_detail, load_customers_into_cache

async def main():
    load_customers_into_cache()
    
    test_ids = ["cust_0001", "cust_0002", "cust_0004", "cust_0005", "cust_0006"]
    
    for cid in test_ids:
        resp = await get_ticket_detail(cid)
        print(f"\n==========================================")
        print(f"CUSTOMER: {resp.customer.customer_id} ({resp.customer.display_label})")
        print(f"ORDER DETAILS: #{resp.customer.order_details.order_id} | {resp.customer.order_details.item_name} ({resp.customer.order_details.price})")
        print(f"TRACKING STATUS: {resp.customer.order_details.tracking_status}")
        print(f"RISK LEVEL: {resp.risk_profile.risk_level.upper()}")
        print(f"RECOMMENDATION HEADLINE: {resp.action_recommendation.headline}")
        print(f"RECOMMENDED ACTION: {resp.action_recommendation.recommended_action}")
        print(f"RATIONALE: {resp.action_recommendation.rationale}")
        print(f"SESSIONS ({len(resp.frustration_trajectory.sessions)}):")
        for s in resp.frustration_trajectory.sessions:
            print(f"  - [{s.session_label}] Score: {s.frustration_score}% ({s.frustration_level}) | Reason: {s.summary_reason}")

if __name__ == "__main__":
    asyncio.run(main())
