# ARC-03 — Development và production

Sơ đồ mô tả môi trường và hợp đồng triển khai, không xác nhận dịch vụ đã deploy. OCR trực tiếp bị vô hiệu trong release; kiểm chứng background cần thiết bị và bản dựng phù hợp.

```mermaid
flowchart TB
    subgraph Development[Môi trường phát triển]
        Expo[Expo Go trên điện thoại]
        Metro[Metro trên máy phát triển]
        LocalOCR[PaddleOCR qua LAN]
        Expo --> Metro
        Expo -->|Chỉ development| LocalOCR
    end
    subgraph Release[Hợp đồng bản phát hành]
        App[Android hoặc iOS build]
        Gateway[Express HTTPS gateway]
        OCR[PaddleOCR service]
        Media[Cloudinary private media]
        Pay[payOS và webhook]
        App --> Gateway
        Gateway --> OCR
        Gateway --> Media
        Gateway <--> Pay
    end
    Fire[(Firebase Auth và Firestore Spark)]
    Expo <--> Fire
    App <--> Fire
    Gateway --> Fire
```

Nguồn đối chiếu: [decisions/ADR-010-expo-go-firebase-js.md](../../decisions/ADR-010-expo-go-firebase-js.md), [api-contracts.md](../../api-contracts.md), [decisions/ADR-025-payos-expiring-premium.md](../../decisions/ADR-025-payos-expiring-premium.md).
