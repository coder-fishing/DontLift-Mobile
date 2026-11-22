# CLS-04 — Kiểu dữ liệu tính hóa đơn

Các type BillAllocationMember, BillShare, BillAllocation, BillShareOverride và BillAllocationError có trong bill-allocation.ts. Các thao tác trên AllocationModule mô tả thuật toán, không giả lập tên hàm xuất.

```mermaid
classDiagram
    class BillAllocationMember {
        +string uid
        +number penaltyScore
    }
    class BillShare {
        +string uid
        +number shareVnd
    }
    class BillAllocation {
        +number totalBillVnd
        +number sumShareVnd
    }
    class BillShareOverride {
        +string uid
        +string type
        +number value
    }
    class BillAllocationError {
        +string code
    }
    class AllocationModule {
        <<module>>
        integerArithmetic()
        deterministicResidualDistribution()
    }
    BillAllocation "1" *-- "1..*" BillShare : shares
    AllocationModule ..> BillAllocationMember : đầu vào
    AllocationModule ..> BillShareOverride : tùy chọn
    AllocationModule --> BillAllocation : kết quả
    AllocationModule ..> BillAllocationError : lỗi
```

Nguồn đối chiếu: [decisions/ADR-021-spark-default-bill.md](../../decisions/ADR-021-spark-default-bill.md), [decisions/ADR-022-spark-bill-overrides.md](../../decisions/ADR-022-spark-bill-overrides.md).
