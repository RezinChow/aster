# 按钮级交互规范

所有线框控件使用统一标注：

```text
#ID  [可见文案]  ·kind
     → 点击/激活后的结果
     enable: 何时可点
     disable: 何时灰显 + 原因 Tooltip
     loading: 提交中文案/锁
     confirm: 是否二次确认（文案）
     a11y: 键盘 / aria
```

## kind 枚举

| kind | 视觉 | 每屏数量 |
| --- | --- | --- |
| `primary` | 实心主色 | ≤ 1（页级） |
| `secondary` | 描边/次要 | 0–2 |
| `ghost` | 文本/图标 | 不限 |
| `danger` | 危险色 | 仅破坏性 |
| `chip` | 筛选胶囊 | 互斥或多选组 |
| `tab` | 分段/页签 | 组内互斥 |
| `icon` | 仅图标 | 必须 aria-label |
| `row` | 行内文本按钮 | 表格操作列 |
| `menuitem` | 菜单项 | 弹出层内 |

## 全局交互不变量

1. **Enter** 在对话框默认激活 primary（除非焦点在 textarea）。  
2. **Escape** 关闭层：先关最上层（Menu → Modal → Drawer）。  
3. 危险操作：**必须** `confirm` Modal，primary 为危险色且默认不聚焦。  
4. 异步提交：按钮 `loading` 锁定重复点击；失败 Toast + 按钮恢复。  
5. 无权限：控件 `disable` 或隐藏；隐藏优先于「点了再 403」。  
6. Tooltip：黑底白字；不替代 `aria-label`。
