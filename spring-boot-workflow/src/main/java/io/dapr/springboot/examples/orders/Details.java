package io.dapr.springboot.examples.orders;

import java.util.Date;

public class Details {
  private String message;
  private Date date;

  public Details() {
  }

  public Details(String message, Date date) {
    this.message = message;
    this.date = date;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public Date getDate() {
    return date;
  }

  public void setDate(Date date) {
    this.date = date;
  }

  @Override
  public String toString() {
    return "Details{" +
            "message='" + message + '\'' +
            ", date=" + date +
            '}';
  }
}
