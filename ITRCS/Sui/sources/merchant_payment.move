module bls_signature::merchant_payment {
    use std::string;
    use sui::table;

    public struct Merchant has key, store {
        id: sui::object::UID,
        blob_id: string::String,
        name: string::String,       // 新增：商户名称
        industry: string::String,   // 新增：商户行业
        address: address
    }

     // 商户信息结构体（用于返回给前端）
    public struct MerchantInfo has copy, drop {
        blob_id: string::String,
        name: string::String,
        industry: string::String,
        address: address
    }

    public struct MerchantTransaction has key, store {
        id: sui::object::UID,
        merchant_blob_id: string::String,
        transaction_blob_id: string::String,
        timestamp: u64
    }

    public struct MerchantReport has key, store {
        id: sui::object::UID,
        merchant_blob_id: string::String,
        report_blob_id: string::String,
        timestamp: u64
    }

    public struct GlobalState has key {
        id: sui::object::UID,
        merchants: table::Table<string::String, Merchant>,
        merchant_ids: vector<string::String>, // 新增：存储所有商户的blob_id
        merchant_transactions: table::Table<u64, MerchantTransaction>,
        merchant_reports: table::Table<u64, MerchantReport>,
        next_transaction_index: u64,
        next_report_index: u64
    }

    const E_EMPTY_BLOB_ID: u64 = 2;
    const E_MERCHANT_NOT_FOUND: u64 = 3;
    const E_NO_REPORT_FOUND: u64 = 4;
    const E_EMPTY_NAME: u64 = 5;        // 新增：名称为空
    const E_EMPTY_INDUSTRY: u64 = 6;    // 新增：行业为空

    fun init(ctx: &mut sui::tx_context::TxContext) {
        let global_state = GlobalState {
            id: sui::object::new(ctx),
            merchants: table::new(ctx),
            merchant_ids: vector::empty<string::String>(), // 初始化空列表
            merchant_transactions: table::new(ctx),
            merchant_reports: table::new(ctx),
            next_transaction_index: 1,
            next_report_index: 1
        };
        //sui::transfer::transfer(global_state, sui::tx_context::sender(ctx))
        sui::transfer::share_object(global_state); // 发布为共享对象，允许所有调用者修改
    }

    public fun register_merchant(
        blob_id: string::String,
        name: string::String,           // 新增：商户名称
        industry: string::String,       // 新增：商户行业
        merchant_address: address,
        global_state: &mut GlobalState,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(!string::is_empty(&blob_id), E_EMPTY_BLOB_ID);
        assert!(!string::is_empty(&name), E_EMPTY_NAME);         // 新增：校验名称非空
        assert!(!string::is_empty(&industry), E_EMPTY_INDUSTRY); // 新增：校验行业非空
        // 新增：检查ID是否已存在
        assert!(!vector::contains(&global_state.merchant_ids, &blob_id), E_MERCHANT_NOT_FOUND);
        let merchant = Merchant {
            id: sui::object::new(ctx),
            blob_id: blob_id,
            name: name,           // 新增：存储名称
            industry: industry,   // 新增：存储行业
            address: merchant_address
        };
        vector::push_back(&mut global_state.merchant_ids, merchant.blob_id); // 记录ID
        table::add(&mut global_state.merchants, merchant.blob_id, merchant)
    }


      // 新增：查询所有商户信息（返回给前端）
    public fun get_all_merchant_info(global_state: &mut GlobalState): vector<MerchantInfo> {
        let mut all_info = vector::empty<MerchantInfo>();
        let ids = &global_state.merchant_ids; // 直接使用维护好的ID列表
        let mut i = 0;
        
        while (i < vector::length(ids)) {
            let blob_id = *vector::borrow(ids, i);
            // 取出商户
            // 改为不可变引用 &global_state.merchants
            let merchant = table::borrow(&global_state.merchants, blob_id);
            // 封装信息
            let info = MerchantInfo {
                blob_id: merchant.blob_id,
                name: merchant.name,
                industry: merchant.industry,
                address: merchant.address
            };
            vector::push_back(&mut all_info, info);
            i = i + 1;
        };
        
        all_info
    }

    public fun get_merchant_address(
        global_state: &mut GlobalState,
        blob_id: string::String
    ): address {
        let merchant = table::remove(&mut global_state.merchants, blob_id);
        let addr = merchant.address;
        table::add(&mut global_state.merchants, merchant.blob_id, merchant);
        addr
    }

    public fun record_merchant_transaction(
        merchant_blob_id: string::String,
        transaction_blob_id: string::String,
        global_state: &mut GlobalState,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(!string::is_empty(&merchant_blob_id), E_EMPTY_BLOB_ID);
        assert!(!string::is_empty(&transaction_blob_id), E_EMPTY_BLOB_ID);
        assert!(table::contains(&global_state.merchants, merchant_blob_id), E_MERCHANT_NOT_FOUND);
        
        let transaction = MerchantTransaction {
            id: sui::object::new(ctx),
            merchant_blob_id: merchant_blob_id,
            transaction_blob_id: transaction_blob_id,
            timestamp: sui::tx_context::epoch(ctx) * 86400000
        };
        let index = global_state.next_transaction_index;
        table::add(&mut global_state.merchant_transactions, index, transaction);
        global_state.next_transaction_index = index + 1
    }

    public fun get_merchant_latest_transactions(
        merchant_blob_id: string::String,
        global_state: &GlobalState
    ): vector<string::String> {
        assert!(table::contains(&global_state.merchants, merchant_blob_id), E_MERCHANT_NOT_FOUND);
        
        let mut all_txs = vector::empty<string::String>();
        let mut idx = 1;
        
        while (idx < global_state.next_transaction_index) {
            if (table::contains(&global_state.merchant_transactions, idx)) {
                let tx = table::borrow(&global_state.merchant_transactions, idx);
                if (tx.merchant_blob_id == merchant_blob_id) {
                    vector::push_back(&mut all_txs, tx.transaction_blob_id)
                }
            };
            idx = idx + 1
        };
        
        let total = vector::length(&all_txs);
        let start = if (total > 30) total - 30 else 0;
        let mut result = vector::empty<string::String>();
        let mut i = start;
        
        while (i < total) {
            vector::push_back(&mut result, *vector::borrow(&all_txs, i));
            i = i + 1
        };
        
        result
    }

    public fun record_merchant_report(
        merchant_blob_id: string::String,
        report_blob_id: string::String,
        global_state: &mut GlobalState,
        ctx: &mut sui::tx_context::TxContext
    ) {
        assert!(!string::is_empty(&merchant_blob_id), E_EMPTY_BLOB_ID);
        assert!(!string::is_empty(&report_blob_id), E_EMPTY_BLOB_ID);
        assert!(table::contains(&global_state.merchants, merchant_blob_id), E_MERCHANT_NOT_FOUND);
        
        let report = MerchantReport {
            id: sui::object::new(ctx),
            merchant_blob_id: merchant_blob_id,
            report_blob_id: report_blob_id,
            timestamp: sui::tx_context::epoch(ctx)
        };
        let index = global_state.next_report_index;
        table::add(&mut global_state.merchant_reports, index, report);
        global_state.next_report_index = index + 1
    }

    public fun get_merchant_latest_report(
        merchant_blob_id: string::String,
        global_state: &GlobalState
    ): string::String {
        assert!(table::contains(&global_state.merchants, merchant_blob_id), E_MERCHANT_NOT_FOUND);
        
        let mut latest_idx = 0;
        let mut latest_report = string::utf8(b"");
        let mut idx = 1;
        
        while (idx < global_state.next_report_index) {
            if (table::contains(&global_state.merchant_reports, idx)) {
                let report = table::borrow(&global_state.merchant_reports, idx);
                if (report.merchant_blob_id == merchant_blob_id && idx > latest_idx) {
                    latest_idx = idx;
                    latest_report = report.report_blob_id
                }
            };
            idx = idx + 1
        };
        
        assert!(!string::is_empty(&latest_report), E_NO_REPORT_FOUND);
        latest_report
    }
}