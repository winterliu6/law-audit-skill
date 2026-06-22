"""
工单分发调度模块：客服统一收单、按需派单流转
"""
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from ..database import WorkOrder


def create_order(db: Session, user_id: int, assigned_role: str, title: str, description: str = "", created_by: int = None) -> WorkOrder:
    """创建工单（客服收单后派发）"""
    order = WorkOrder(
        user_id=user_id,
        assigned_role=assigned_role,
        status="pending",
        title=title,
        description=description,
        created_by=created_by or user_id
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order


def assign_order(db: Session, order_id: int, role: str) -> WorkOrder:
    """指派工单到特定角色"""
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("工单不存在")
    order.assigned_role = role
    order.status = "pending"
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order


def accept_order(db: Session, order_id: int, user_id: int) -> WorkOrder:
    """接单：开始处理"""
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("工单不存在")
    order.status = "processing"
    order.assigned_to = user_id
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order


def complete_order(db: Session, order_id: int, result: str) -> WorkOrder:
    """完成工单并填写结果"""
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("工单不存在")
    order.status = "done"
    order.result = result
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order


def return_order(db: Session, order_id: int, reason: str) -> WorkOrder:
    """退回工单给客服（附退回原因）"""
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("工单不存在")
    order.status = "returned"
    order.result = f"[退回原因] {reason}"
    order.assigned_role = "csr"  # 退回给客服
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order


def get_orders(db: Session, role: str = None, status: str = None, user_id: int = None) -> list:
    """查询工单列表，支持按角色/状态/用户过滤"""
    query = db.query(WorkOrder)
    if role:
        query = query.filter(WorkOrder.assigned_role == role)
    if status:
        query = query.filter(WorkOrder.status == status)
    if user_id:
        query = query.filter(WorkOrder.user_id == user_id)
    return query.order_by(WorkOrder.created_at.desc()).all()


def transfer_order(db: Session, order_id: int, to_role: str) -> WorkOrder:
    """跨角色转派工单"""
    order = db.query(WorkOrder).filter(WorkOrder.id == order_id).first()
    if not order:
        raise ValueError("工单不存在")
    order.assigned_role = to_role
    order.status = "pending"
    order.assigned_to = None
    order.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(order)
    return order
