package io.dapr.springboot.examples.orders;

public class OrderUpdate {
  private String orderId;
  private String status;
  private Details details;

  public OrderUpdate(String orderId, String status, Details details) {
    this.orderId = orderId;
    this.status = status;
    this.details = details;
  }

  public String getOrderId() {
    return orderId;
  }

  public void setOrderId(String orderId) {
    this.orderId = orderId;
  }

  public String getStatus() {
    return status;
  }

  public void setStatus(String status) {
    this.status = status;
  }

  public Details getDetails() {
    return details;
  }

  public void setDetails(Details details) {
    this.details = details;
  }

  @Override
  public String toString() {
    return "OrderUpdate{" +
            "orderId='" + orderId + '\'' +
            ", status='" + status + '\'' +
            ", details=" + details +
            '}';
  }
}
