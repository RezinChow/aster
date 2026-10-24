# Data model: 执行身份、状态与实验

这里定义数据合同，不新增产品配置格式。正式配置依然是 ACL。

| Entity | Owner | 必须绑定的内容 | 拒绝条件 |
|---|---|---|---|
| ModelExecutionBinding | 模型所有者 + Power 收据 | checkpoint/shard hashes、tokenizer/template、量化 schema、模型图、构建 features、实际 kernel/ABI identity | 任意运行时输入与绑定不符；不能靠模型名补猜 |
| QuantizedTensorDescriptor | 模型所有者 | 维度、packed dtype、block/scale layout、比例因子身份、原始字节范围 | 缺失 scale、越界、未知格式、隐式精度转换 |
| NativeKernelCapability | Power 通用加速器接口 | 实际可执行 dtype/shape/SM、内核版本、设备与 scratch | 只声明不可调用能力、隐式 CPU 或外部服务 fallback |
| ParallelPlacement | 模型所有者 + Power device mesh | 精确 rank/device、TP/EP/attention 分组、collective 顺序、权重分片、scratch/通信预算 | 未实现 collective、缺少 rank、预算超限、epoch 不一致 |
| ModelSessionState | 模型所有者 | 位置、KV/压缩状态/SWA、Engram 关联状态、版本、草稿回滚点 | 取消后复用未提交状态、跨模型/调用者复用、位置跳变 |
| PrefixCacheEntry | 模型所有者 | 隔离命名空间、精确 token prefix、状态格式、模型/模板/tokenizer identity、epoch、实际驻留层级 | 只凭文本哈希猜可复用、过期 epoch、状态不完整 |
| HardwareCostProfile | 模型性能所有者 | GPU/topology、模型与内核、shape range、prefill/verify 曲线、时间/TTL、采样散布 | 外推、过期、NaN、不匹配 revision、单位不明 |
| SpeculativeExecution | 模型所有者 + Power batch lifecycle | 目标/草稿绑定、候选、验证结果、接受数、rank 一致决策与回滚界限 | 目标验证未通过、未知 confidence、未提交 KV 泄露 |
| ExperimentRecord | qualification 工具 | 两臂执行绑定、corpus/hash、有效上下文、并发、缓存、采样、思考模式、完整失败和时间/token 样本 | 只留成功、取整用量、缺失对照、量化身份不同却算倍率 |

## 实验结论字段

- `single_request_output_tokens_per_second`：单请求测量，含输入与排队的 request-wide 值单独保留。
- `aggregate_output_tokens_per_second`：一个并发批次的实际完成 token 总数除以完整 wall time。
- `single_request_target_reached` 与 `aggregate_target_reached` 分别比较 1000；禁止相互推导。
- `quality_qualified`、`native_execution_verified`、`memory_qualified` 与 `performance_qualified` 分开；任何缺失不能晋升。
- `execution_provider` 记录真实计算提供者；SGLang / Xolotl 参考结果不能写成 Power native。
- 字段名为规划提案，实施时使用现有公开合同可表达的字段；新增字段保持兼容、闭集与隐私边界。

## 隐私和保留

收据与一般观测保存必要的身份散列和聚合值；不写 token 内容、原始 prompt、API key、租户身份或 KV 数据。
性能测试使用固定非敏感合成输入及可核验的精确计数；正常服务恢复脱敏。基准中的 prompt/状态夹具属于测试资源，不成为产品配置。
